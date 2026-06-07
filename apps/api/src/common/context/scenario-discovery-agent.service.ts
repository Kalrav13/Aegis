import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  ScenarioDiscoveryContext,
  Scenario,
  ScenarioDiscoveryOutputSchema
} from '@testlens/contracts';
import { randomUUID } from 'crypto';

@Injectable()
export class ScenarioDiscoveryAgentService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Discovers business scenarios using the scenario discovery context, processes validations, 
   * applies deduplication/guardrails/traceability, and returns the final sanitized scenario list.
   */
  public async discoverScenarios(context: ScenarioDiscoveryContext): Promise<Scenario[]> {
    // 1. Validate scenarioReadiness before execution
    if (!context.scenarioReadiness.ready) {
      throw new Error(
        `Scenario discovery is blocked: ${context.scenarioReadiness.blockingReasons.join('; ')}`
      );
    }

    // 2. Build optimized prompts from ScenarioDiscoveryContext
    const prompt = this.buildPrompt(context);

    // 3. Query Gemini using JSON mode
    const rawResult = await this.aiService.generateJson(prompt);

    // 4. Sanitize all AI output
    return this.validateAndSanitize(rawResult, context);
  }

  /**
   * Constructs the LLM prompt.
   */
  private buildPrompt(context: ScenarioDiscoveryContext): string {
    return `
You are an expert Lead QA Architect and Senior AI Engineer specializing in business-oriented QA Scenario Discovery.
Your goal is to discover abstract business-oriented Scenarios for the given Features.

=== IMPORTANT RULES ===
1. You MUST discover scenarios. Do NOT generate executable test cases, test steps, script commands, or UI locators. Scenarios must remain business-oriented.
2. Every scenario must map to one or more Features, one or more Workflows, and one or more Evidence files/APIs/routes.
3. Every scenario must include a priority: LOW, MEDIUM, HIGH, or CRITICAL.
4. Output MUST conform strictly to the specified JSON schema. Do not include markdown codeblocks or conversational text.

=== PRIORITY CLASSIFICATION RULES ===
- LOW: Cosmetic flows, secondary user journeys, low business impact.
- MEDIUM: Common workflows, moderate business impact.
- HIGH: Core business functionality, frequently used workflows, revenue-impacting actions.
- CRITICAL: Authentication, payments, financial operations, security-sensitive workflows, data integrity operations.

=== SCENARIO TYPES ===
- POSITIVE: Happy-path flows verifying correct function under normal inputs.
- NEGATIVE: Error-handling flows verifying graceful degradation under bad inputs.
- EDGE_CASE: Boundary or rare conditions.
- SECURITY: Access control, data leakage, injection, or authentication vulnerabilities.
- PERFORMANCE: High volume, stress, scale, or latency risks.
- INTEGRATION: Cross-component or external service integration boundaries.

=== FEATURE LIST ===
${JSON.stringify(
  context.featureSummary.map(f => ({
    name: f.featureName,
    type: f.featureType,
    description: f.description,
    riskLevel: f.riskLevel,
    evidence: f.evidence,
    sourceWorkflows: f.sourceWorkflows
  })),
  null,
  2
)}

=== WORKFLOW LIST ===
${JSON.stringify(
  context.workflowSummary.map(w => ({
    name: w.name,
    description: w.description,
    steps: w.steps,
    evidence: w.evidence
  })),
  null,
  2
)}

=== CANDIDATE ASSETS ===
- Routes: ${JSON.stringify(context.candidateAssets.routes)}
- APIs: ${JSON.stringify(context.candidateAssets.apis)}
- Forms: ${JSON.stringify(context.candidateAssets.forms)}

=== OUTPUT SCHEMA ===
Return a JSON object conforming exactly to:
{
  "scenarios": [
    {
      "scenarioName": "<Concise name of scenario, e.g. Authenticate User with Valid MFA Token>",
      "scenarioType": "POSITIVE | NEGATIVE | EDGE_CASE | SECURITY | PERFORMANCE | INTEGRATION",
      "priority": "LOW | MEDIUM | HIGH | CRITICAL",
      "description": "<Detailed business scenario flow explanation, at least 10 chars long>",
      "confidenceScore": <number between 0.5 and 1.0>,
      "riskLevel": "<matches parent feature risk level or assessed risk, e.g. CRITICAL>",
      "parentFeatures": ["<exact name of the parent feature(s)>"],
      "sourceWorkflows": ["<exact name of the source workflow(s)>"],
      "evidence": ["<candidate routes, apis, or forms cited as grounding evidence>"]
    }
  ]
}
`;
  }

  /**
   * Sanitizes, normalizes, maps coverage, maps traceability, dedups, and applies guardrails.
   */
  private validateAndSanitize(rawJson: string, context: ScenarioDiscoveryContext): Scenario[] {
    const parsedObj = JSON.parse(rawJson);
    const rawScenarios = Array.isArray(parsedObj.scenarios) ? parsedObj.scenarios : [];

    // Compile candidate assets for evidence matching
    const validRoutes = new Set(context.candidateAssets.routes.map(r => r.toLowerCase().trim()));
    const validApis = new Set(context.candidateAssets.apis.map(a => a.toLowerCase().trim()));
    const validForms = new Set(context.candidateAssets.forms.map(f => f.toLowerCase().trim()));
    const allValidAssets = new Set([...validRoutes, ...validApis, ...validForms]);

    const workflowMap = new Map<string, string>(); // Name (lowercase) -> Name (original)
    context.workflowSummary.forEach(w => {
      workflowMap.set(w.name.toLowerCase().trim(), w.name);
    });

    const featureMap = new Map<string, { id: string; name: string; riskLevel: string }>(); // Name (lowercase) -> Feature Meta
    context.featureSummary.forEach(f => {
      featureMap.set(f.featureName.toLowerCase().trim(), {
        id: f.id,
        name: f.featureName,
        riskLevel: f.riskLevel
      });
    });

    const sanitizedScenarios: Scenario[] = [];

    for (const rawS of rawScenarios) {
      // 1. Evidence Grounding & Coverage Target Mapping
      const evidence = Array.isArray(rawS.evidence) ? rawS.evidence : [];
      const validEvidence: string[] = [];
      const coverageTargets = {
        routes: [] as string[],
        apis: [] as string[],
        forms: [] as string[]
      };

      for (const ev of evidence) {
        const normEv = ev.toLowerCase().trim();
        let matchedAsset: string | null = null;
        let matchedType: 'route' | 'api' | 'form' | null = null;

        // Try exact match first
        if (validRoutes.has(normEv)) {
          matchedAsset = context.candidateAssets.routes.find(r => r.toLowerCase().trim() === normEv) || ev;
          matchedType = 'route';
        } else if (validApis.has(normEv)) {
          matchedAsset = context.candidateAssets.apis.find(a => a.toLowerCase().trim() === normEv) || ev;
          matchedType = 'api';
        } else if (validForms.has(normEv)) {
          matchedAsset = context.candidateAssets.forms.find(f => f.toLowerCase().trim() === normEv) || ev;
          matchedType = 'form';
        } else {
          // Try partial/fuzzy match
          for (const route of context.candidateAssets.routes) {
            const rNorm = route.toLowerCase().trim();
            if (rNorm.endsWith(normEv) || normEv.endsWith(rNorm)) {
              matchedAsset = route;
              matchedType = 'route';
              break;
            }
          }
          if (!matchedAsset) {
            for (const api of context.candidateAssets.apis) {
              const aNorm = api.toLowerCase().trim();
              if (aNorm.endsWith(normEv) || normEv.endsWith(aNorm)) {
                matchedAsset = api;
                matchedType = 'api';
                break;
              }
            }
          }
          if (!matchedAsset) {
            for (const form of context.candidateAssets.forms) {
              const fNorm = form.toLowerCase().trim();
              if (fNorm.endsWith(normEv) || normEv.endsWith(fNorm)) {
                matchedAsset = form;
                matchedType = 'form';
                break;
              }
            }
          }
        }

        if (matchedAsset && matchedType) {
          validEvidence.push(matchedAsset);
          if (matchedType === 'route' && !coverageTargets.routes.includes(matchedAsset)) {
            coverageTargets.routes.push(matchedAsset);
          } else if (matchedType === 'api' && !coverageTargets.apis.includes(matchedAsset)) {
            coverageTargets.apis.push(matchedAsset);
          } else if (matchedType === 'form' && !coverageTargets.forms.includes(matchedAsset)) {
            coverageTargets.forms.push(matchedAsset);
          }
        }
      }

      // Drop if no evidence or no coverage targets
      if (validEvidence.length === 0 || 
          (coverageTargets.routes.length === 0 && coverageTargets.apis.length === 0 && coverageTargets.forms.length === 0)) {
        console.warn(`Discarding scenario "${rawS.scenarioName}" due to empty or ungrounded evidence/coverage targets.`);
        continue;
      }

      // 2. Workflow Validation & Traceability Mapping
      const sourceWorkflows = Array.isArray(rawS.sourceWorkflows) ? rawS.sourceWorkflows : [];
      const validWorkflows: string[] = [];
      const workflowIds: string[] = [];

      for (const wf of sourceWorkflows) {
        const normWf = wf.toLowerCase().trim();
        if (workflowMap.has(normWf)) {
          const originalName = workflowMap.get(normWf)!;
          validWorkflows.push(originalName);
          // Generate stable workflow identifier (slug)
          const slug = originalName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
          workflowIds.push(slug);
        }
      }

      // Drop if no workflows
      if (validWorkflows.length === 0) {
        console.warn(`Discarding scenario "${rawS.scenarioName}" because all source workflows were invalid/unmapped.`);
        continue;
      }

      // 3. Parent Feature Matching & Traceability
      const parentFeatures = Array.isArray(rawS.parentFeatures) ? rawS.parentFeatures : [];
      const validFeatures: string[] = [];
      const featureIds: string[] = [];

      for (const pf of parentFeatures) {
        const normPf = pf.toLowerCase().trim();
        if (featureMap.has(normPf)) {
          const meta = featureMap.get(normPf)!;
          validFeatures.push(meta.name);
          featureIds.push(meta.id);
        }
      }

      // Drop if no parent features
      if (validFeatures.length === 0) {
        console.warn(`Discarding scenario "${rawS.scenarioName}" because all parent features were invalid/unmapped.`);
        continue;
      }

      // 4. Build parsed Scenario structure matching ScenarioSchema
      sanitizedScenarios.push({
        scenarioId: randomUUID(), // Assign stable UUID
        scenarioName: String(rawS.scenarioName || 'Unnamed Scenario').trim(),
        scenarioType: rawS.scenarioType,
        priority: rawS.priority,
        description: String(rawS.description || '').trim(),
        confidenceScore: typeof rawS.confidenceScore === 'number' ? rawS.confidenceScore : 0.5,
        riskLevel: String(rawS.riskLevel || 'LOW').trim(),
        parentFeatures: validFeatures,
        sourceWorkflows: validWorkflows,
        evidence: validEvidence,
        coverageTargets,
        scenarioOrigin: {
          featureIds,
          workflowIds
        }
      });
    }

    // 5. Normalization & Deduplication
    const dedupedScenariosMap = new Map<string, Scenario>();
    for (const s of sanitizedScenarios) {
      // Deduplication rules: lowercase, trim spaces, collapse whitespace
      const normalizedName = s.scenarioName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

      const sortedParentFeatureIds = [...s.scenarioOrigin!.featureIds].sort();
      const key = normalizedName + s.scenarioType + sortedParentFeatureIds.join(',');

      if (dedupedScenariosMap.has(key)) {
        const existing = dedupedScenariosMap.get(key)!;
        if (s.confidenceScore > existing.confidenceScore) {
          dedupedScenariosMap.set(key, s);
        }
      } else {
        dedupedScenariosMap.set(key, s);
      }
    }

    let finalScenarios = Array.from(dedupedScenariosMap.values());

    // 6. Scenario Count Guardrails (Per Feature)
    for (const feature of context.featureSummary) {
      const featureId = feature.id;
      const featureScenarios = finalScenarios.filter(s => s.scenarioOrigin?.featureIds.includes(featureId));

      // Guardrail Check: Minimum 3 scenarios
      if (featureScenarios.length < 3) {
        throw new Error(
          `Feature "${feature.featureName}" does not meet minimum scenario count guardrail: expected at least 3, got ${featureScenarios.length}`
        );
      }

      const positiveScenarios = featureScenarios.filter(s => s.scenarioType === 'POSITIVE');
      const negativeScenarios = featureScenarios.filter(s => s.scenarioType === 'NEGATIVE');

      // Guardrail Check: At least 1 POSITIVE
      if (positiveScenarios.length === 0) {
        throw new Error(
          `Feature "${feature.featureName}" does not meet priority coverage: missing POSITIVE scenario`
        );
      }

      // Guardrail Check: At least 1 NEGATIVE
      if (negativeScenarios.length === 0) {
        throw new Error(
          `Feature "${feature.featureName}" does not meet priority coverage: missing NEGATIVE scenario`
        );
      }

      // Risk Guardrail Check: HIGH/CRITICAL features must have at least 1 SECURITY or EDGE_CASE
      const risk = feature.riskLevel.toUpperCase().trim();
      const isHighOrCritical = risk === 'HIGH' || risk === 'CRITICAL';
      const securityOrEdge = featureScenarios.filter(s => s.scenarioType === 'SECURITY' || s.scenarioType === 'EDGE_CASE');

      if (isHighOrCritical && securityOrEdge.length === 0) {
        throw new Error(
          `Feature "${feature.featureName}" is ${feature.riskLevel} risk but does not meet priority coverage: missing SECURITY or EDGE_CASE scenario`
        );
      }

      // Guardrail Check: Maximum 15 scenarios
      if (featureScenarios.length > 15) {
        // Pick one of each required type with highest confidence
        const selected: Scenario[] = [];

        const bestPos = positiveScenarios.reduce((b, c) => c.confidenceScore > b.confidenceScore ? c : b, positiveScenarios[0]);
        selected.push(bestPos);

        const bestNeg = negativeScenarios.reduce((b, c) => c.confidenceScore > b.confidenceScore ? c : b, negativeScenarios[0]);
        if (!selected.includes(bestNeg)) selected.push(bestNeg);

        if (isHighOrCritical) {
          const bestSecOrEdge = securityOrEdge.reduce((b, c) => c.confidenceScore > b.confidenceScore ? c : b, securityOrEdge[0]);
          if (!selected.includes(bestSecOrEdge)) selected.push(bestSecOrEdge);
        }

        // Sort all by confidence score descending
        const sortedAll = [...featureScenarios].sort((a, b) => b.confidenceScore - a.confidenceScore);

        // Fill remaining slots up to 15
        for (const s of sortedAll) {
          if (selected.length >= 15) break;
          if (!selected.includes(s)) {
            selected.push(s);
          }
        }

        const allowedIds = new Set(selected.map(s => s.scenarioId));
        finalScenarios = finalScenarios.filter(s => {
          if (s.scenarioOrigin?.featureIds.includes(featureId)) {
            return allowedIds.has(s.scenarioId);
          }
          return true;
        });
      }
    }

    // 7. Validate output against ScenarioDiscoveryOutputSchema
    const validatedOutput = ScenarioDiscoveryOutputSchema.parse({ scenarios: finalScenarios });
    return validatedOutput.scenarios;
  }
}
