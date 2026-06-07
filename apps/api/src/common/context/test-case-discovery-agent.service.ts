import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  TestCaseDiscoveryContext,
  TestCase,
  TestCaseDiscoveryOutput,
  TestCaseDiscoveryOutputSchema,
  TestCaseSchema
} from '@testlens/contracts';
import { randomUUID } from 'crypto';

interface RawGeneratedTestCase {
  testCaseName: string;
  testCaseType: string;
  priority: string;
  description: string;
  preconditions: string[];
  steps: {
    stepNumber: number;
    action: string;
    expectedResult: string;
  }[];
  expectedResult: string;
  evidence: string[];
  parentScenarioId: string;
}

@Injectable()
export class TestCaseDiscoveryAgentService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Discovers manual, framework-agnostic test cases based on the TestCaseDiscoveryContext.
   */
  public async discoverTestCases(context: TestCaseDiscoveryContext): Promise<{
    testCases: TestCase[];
    readiness: { ready: boolean; blockingReasons: string[] };
  }> {
    // 1. Verify upstream scenario readiness before executing
    if (!context.testCaseReadiness.ready) {
      return {
        testCases: [],
        readiness: {
          ready: false,
          blockingReasons: [
            `Upstream context is not ready: ${context.testCaseReadiness.blockingReasons.join('; ')}`
          ]
        }
      };
    }

    // 2. Build AI prompt
    const prompt = this.buildPrompt(context);

    // 3. Query Gemini via JSON mode
    let rawOutput: any = { testCases: [] };
    try {
      const response = await this.aiService.generateJson(prompt);
      rawOutput = JSON.parse(response);
    } catch (error: any) {
      return {
        testCases: [],
        readiness: {
          ready: false,
          blockingReasons: [`Gemini generation failed: ${error.message}`]
        }
      };
    }

    const rawTestCases: RawGeneratedTestCase[] = Array.isArray(rawOutput.testCases)
      ? rawOutput.testCases
      : [];

    // 4. In-Memory Sanitization, Grounding, Traceability, Scoring, and Key Sequencing
    const processedTestCases = this.sanitizeAndValidate(rawTestCases, context);

    // 5. Evaluate final generation readiness
    const readiness = this.evaluateReadiness(processedTestCases, context);

    return {
      testCases: processedTestCases,
      readiness
    };
  }

  /**
   * Generates the optimized JSON mode prompt for Gemini.
   */
  private buildPrompt(context: TestCaseDiscoveryContext): string {
    return `
You are a Principal QA Architect and Staff SDET specializing in manual, framework-agnostic test case design.
Your task is to transform business-oriented QA scenarios into detailed, step-by-step test cases.

=== RULES ===
1. You MUST generate manual test cases. Do NOT include Playwright, Cypress, Selenium, Puppeteer, or any automation code/framework syntax.
2. Every test case must have detailed step-by-step actions and expected results.
3. Every test case must map back to a valid "parentScenarioId" from the context.
4. Output MUST conform exactly to the specified JSON schema structure.

=== SCENARIO LIST ===
${JSON.stringify(
  context.scenarios.map(s => ({
    id: s.id,
    name: s.scenarioName,
    type: s.scenarioType,
    priority: s.priority,
    description: s.description,
    evidence: s.evidence,
    workflows: s.sourceWorkflows
  })),
  null,
  2
)}

=== CANDIDATE ASSET WHITELIST ===
You MUST only cite evidence paths that exist inside these candidate lists:
- Routes: ${JSON.stringify(context.candidateAssets.routes)}
- APIs: ${JSON.stringify(context.candidateAssets.apis)}
- Forms: ${JSON.stringify(context.candidateAssets.forms)}

=== OUTPUT SCHEMA ===
Return a JSON object conforming exactly to this structure:
{
  "testCases": [
    {
      "testCaseName": "<Concise verb-phrase name: e.g. Verify Login Form Error on Invalid Email>",
      "testCaseType": "FUNCTIONAL | NEGATIVE | EDGE_CASE | SECURITY | PERFORMANCE | INTEGRATION",
      "priority": "LOW | MEDIUM | HIGH | CRITICAL",
      "description": "<Detailed test case description, at least 10 chars>",
      "preconditions": ["<precondition 1>", "<precondition 2>"],
      "steps": [
        {
          "stepNumber": 1,
          "action": "<step action text>",
          "expectedResult": "<step expected result text>"
        }
      ],
      "expectedResult": "<overall expected outcome>",
      "evidence": ["<matching routes/apis/forms from candidate list supporting this test case>"],
      "parentScenarioId": "<exact scenario UUID matching parent>"
    }
  ]
}
`;
  }

  /**
   * Sanitizes, normalizes, grounds, maps, scores, and sequences keys.
   */
  private sanitizeAndValidate(
    rawTestCases: RawGeneratedTestCase[],
    context: TestCaseDiscoveryContext
  ): TestCase[] {
    const validScenarios = new Map(context.scenarios.map(s => [s.id, s]));
    
    // Normalize whitelisted assets
    const whitelistRoutes = new Set(context.candidateAssets.routes.map(r => r.toLowerCase().trim()));
    const whitelistApis = new Set(context.candidateAssets.apis.map(a => a.toLowerCase().trim()));
    const whitelistForms = new Set(context.candidateAssets.forms.map(f => f.toLowerCase().trim()));
    const allWhitelist = new Set([...whitelistRoutes, ...whitelistApis, ...whitelistForms]);

    const normalizePathCasing = (path: string): string => {
      const trimmed = path.trim();
      const apiMatch = trimmed.match(/^(get|post|put|delete|patch|options|head)\s+(.+)$/i);
      if (apiMatch) {
        return `${apiMatch[1].toUpperCase()} ${apiMatch[2].toLowerCase()}`;
      }
      return trimmed.toLowerCase();
    };

    const slugifyWorkflow = (wf: string): string => {
      return wf.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    };

    const RISK_ORDER: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    const testCasesByScenario = new Map<string, TestCase[]>();

    for (const raw of rawTestCases) {
      // 1. Origin Integrity Check
      const scenarioId = raw.parentScenarioId;
      if (!scenarioId || !validScenarios.has(scenarioId)) {
        console.warn(`Pruning test case "${raw.testCaseName}" due to invalid/missing parent scenario ID.`);
        continue;
      }
      const parentScenario = validScenarios.get(scenarioId)!;

      // 2. Grounding Engine
      const rawEvidence = Array.isArray(raw.evidence) ? raw.evidence : [];
      const groundedEvidence: string[] = [];
      const coverageTargets = {
        routes: [] as string[],
        apis: [] as string[],
        forms: [] as string[]
      };

      for (const ev of rawEvidence) {
        const normEv = ev.toLowerCase().trim();
        let matchedAsset: string | null = null;
        let matchedType: 'route' | 'api' | 'form' | null = null;

        if (whitelistRoutes.has(normEv)) {
          matchedAsset = context.candidateAssets.routes.find(r => r.toLowerCase().trim() === normEv) || ev;
          matchedType = 'route';
        } else if (whitelistApis.has(normEv)) {
          matchedAsset = context.candidateAssets.apis.find(a => a.toLowerCase().trim() === normEv) || ev;
          matchedType = 'api';
        } else if (whitelistForms.has(normEv)) {
          matchedAsset = context.candidateAssets.forms.find(f => f.toLowerCase().trim() === normEv) || ev;
          matchedType = 'form';
        } else {
          // Substring/suffix matching
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
          groundedEvidence.push(matchedAsset);
          if (matchedType === 'route' && !coverageTargets.routes.includes(matchedAsset)) {
            coverageTargets.routes.push(matchedAsset);
          } else if (matchedType === 'api' && !coverageTargets.apis.includes(matchedAsset)) {
            coverageTargets.apis.push(matchedAsset);
          } else if (matchedType === 'form' && !coverageTargets.forms.includes(matchedAsset)) {
            coverageTargets.forms.push(matchedAsset);
          }
        }
      }

      // 3. Grounding & Coverage Target Validation: Discard if zero evidence/coverage
      if (groundedEvidence.length === 0 || 
          (coverageTargets.routes.length === 0 && coverageTargets.apis.length === 0 && coverageTargets.forms.length === 0)) {
        console.warn(`Pruning test case "${raw.testCaseName}" due to empty or ungrounded coverage targets.`);
        continue;
      }

      // 4. Traceability Resolver
      const featureIds = parentScenario.coverageTargets ? [] : []; // Stub or empty array depending on design
      // We read feature IDs from parentScenario.scenarioOrigin (if available)
      const originFeatureIds = (parentScenario as any).parentFeatures || []; // Fallback scenario features
      const cleanFeatureIds = Array.isArray((parentScenario as any).scenarioOrigin?.featureIds)
        ? (parentScenario as any).scenarioOrigin.featureIds
        : [];
      
      const cleanWorkflowIds = Array.isArray(parentScenario.sourceWorkflows)
        ? parentScenario.sourceWorkflows.map(slugifyWorkflow)
        : [];

      const testCaseOrigin = {
        featureIds: cleanFeatureIds,
        workflowIds: cleanWorkflowIds,
        scenarioIds: [parentScenario.id]
      };

      // 5. Confidence Score Normalization
      // A. Evidence Density (30%)
      const evCount = groundedEvidence.length;
      const evScore = evCount === 1 ? 0.7 : evCount === 2 ? 0.9 : evCount >= 3 ? 1.0 : 0.0;

      // B. Workflow Linkage (25%)
      // If there's overlap with parent scenario source workflows, linkage is 1.0, otherwise 0.7
      const wfScore = cleanWorkflowIds.length > 0 ? 1.0 : 0.7;

      // C. Scenario Quality (25%)
      const scenQualityScore = parentScenario.qualityScore !== null ? parentScenario.qualityScore / 100 : 0.8;

      // D. Coverage Density (20%)
      const targetCount = coverageTargets.routes.length + coverageTargets.apis.length + coverageTargets.forms.length;
      const targetScore = targetCount === 1 ? 0.7 : targetCount === 2 ? 0.9 : targetCount >= 3 ? 1.0 : 0.0;

      const confidenceScore = Math.round(((evScore * 0.3) + (wfScore * 0.25) + (scenQualityScore * 0.25) + (targetScore * 0.2)) * 100) / 100;

      // 6. Build intermediate TestCase Zod structure
      const parsedTestCase: TestCase = {
        testCaseId: randomUUID(),
        testCaseKey: '', // Sequenced later
        contractVersion: '1.0.0',
        testCaseName: raw.testCaseName.trim(),
        testCaseType: raw.testCaseType as any,
        priority: raw.priority as any,
        description: raw.description || `Test case for scenario: ${parentScenario.scenarioName}`,
        preconditions: Array.isArray(raw.preconditions) ? raw.preconditions : [],
        steps: Array.isArray(raw.steps) ? raw.steps.map(s => ({
          stepNumber: s.stepNumber,
          action: s.action.trim(),
          expectedResult: s.expectedResult.trim()
        })) : [],
        expectedResult: raw.expectedResult.trim(),
        evidence: groundedEvidence,
        riskLevel: (parentScenario as any).riskLevel || 'LOW', // Inherit from parent scenario
        coverageTargets,
        testCaseOrigin,
        automationStatus: 'UNAUTOMATED',
        automationPath: null
      };

      // Store in scenario groups for deduplication, sorting, and guardrail mixes
      if (!testCasesByScenario.has(scenarioId)) {
        testCasesByScenario.set(scenarioId, []);
      }
      
      // Save confidence score on object temporarily (non-blocking)
      (parsedTestCase as any).confidenceScore = confidenceScore;

      testCasesByScenario.get(scenarioId)!.push(parsedTestCase);
    }

    const finalizedTestCases: TestCase[] = [];

    // 7. Apply Deduplication & Guardrails per Scenario
    for (const [scenarioId, list] of testCasesByScenario.entries()) {
      const parentScenario = validScenarios.get(scenarioId)!;

      // A. Deduplication: normalize name + type + scenarioId
      const dedupedMap = new Map<string, TestCase>();
      for (const tc of list) {
        const key = `${tc.testCaseName.toLowerCase().trim().replace(/\s+/g, ' ')}|${tc.testCaseType}|${scenarioId}`;
        if (dedupedMap.has(key)) {
          const existing = dedupedMap.get(key)!;
          if ((tc as any).confidenceScore > (existing as any).confidenceScore) {
            dedupedMap.set(key, tc);
          }
        } else {
          dedupedMap.set(key, tc);
        }
      }

      let scenarioList = Array.from(dedupedMap.values());

      // B. Sort scenarios using selection priority (quality > confidence > risk)
      scenarioList.sort((a, b) => {
        // Since qualityScore is scenario-wide, we sort by test case confidence score first, then risk level
        const cA = (a as any).confidenceScore ?? 0.8;
        const cB = (b as any).confidenceScore ?? 0.8;
        if (cB !== cA) return cB - cA;

        const rA = RISK_ORDER[a.riskLevel?.toUpperCase()] ?? 1;
        const rB = RISK_ORDER[b.riskLevel?.toUpperCase()] ?? 1;
        return rB - rA;
      });

      // C. Guardrail mix checks: Trim max 10
      if (scenarioList.length > 10) {
        scenarioList = scenarioList.slice(0, 10);
      }

      finalizedTestCases.push(...scenarioList);
    }

    // 8. Deterministic Business Key sequencing with Collision Protection
    // Sort all test cases alphabetically by parent feature name, scenario ID, then test case name
    const getParentFeatureName = (tc: TestCase): string => {
      const scenario = validScenarios.get(tc.testCaseOrigin.scenarioIds[0]);
      if (scenario && Array.isArray((scenario as any).parentFeatures) && (scenario as any).parentFeatures.length > 0) {
        return (scenario as any).parentFeatures[0];
      }
      return 'GEN';
    };

    finalizedTestCases.sort((a, b) => {
      const fA = getParentFeatureName(a);
      const fB = getParentFeatureName(b);
      if (fA !== fB) return fA.localeCompare(fB);

      const sA = a.testCaseOrigin.scenarioIds[0];
      const sB = b.testCaseOrigin.scenarioIds[0];
      if (sA !== sB) return sA.localeCompare(sB);

      return a.testCaseName.localeCompare(b.testCaseName);
    });

    const keyCounters = new Map<string, number>();
    const usedKeys = new Set<string>();

    for (const tc of finalizedTestCases) {
      const featName = getParentFeatureName(tc);
      const cleanPrefix = featName
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .substring(0, 4) || 'TC';

      let count = (keyCounters.get(cleanPrefix) || 0) + 1;
      keyCounters.set(cleanPrefix, count);

      let cleanKey = `TC-${cleanPrefix}-${String(count).padStart(3, '0')}`;
      
      // Collision protection check
      while (usedKeys.has(cleanKey)) {
        count++;
        keyCounters.set(cleanPrefix, count);
        cleanKey = `TC-${cleanPrefix}-${String(count).padStart(3, '0')}`;
      }

      tc.testCaseKey = cleanKey;
      usedKeys.add(cleanKey);
    }

    return finalizedTestCases;
  }

  /**
   * Asserts Zod validation and guardrail criteria.
   */
  private evaluateReadiness(
    testCases: TestCase[],
    context: TestCaseDiscoveryContext
  ): { ready: boolean; blockingReasons: string[] } {
    const blockingReasons: string[] = [];

    // 1. Guardrail check: min 2 test cases per scenario
    const countByScenario = new Map<string, number>();
    const typesByScenario = new Map<string, Set<string>>();

    testCases.forEach(tc => {
      const sid = tc.testCaseOrigin.scenarioIds[0];
      countByScenario.set(sid, (countByScenario.get(sid) || 0) + 1);
      
      if (!typesByScenario.has(sid)) {
        typesByScenario.set(sid, new Set());
      }
      typesByScenario.get(sid)!.add(tc.testCaseType);
    });

    for (const scenario of context.scenarios) {
      const count = countByScenario.get(scenario.id) || 0;
      if (count < 2) {
        blockingReasons.push(`Scenario "${scenario.scenarioName}" failed guardrail count: expected at least 2 test cases, got ${count}`);
      }

      const types = typesByScenario.get(scenario.id) || new Set();
      if (!types.has('FUNCTIONAL')) {
        blockingReasons.push(`Scenario "${scenario.scenarioName}" is missing a required FUNCTIONAL test case.`);
      }
      if (!types.has('NEGATIVE')) {
        blockingReasons.push(`Scenario "${scenario.scenarioName}" is missing a required NEGATIVE test case.`);
      }

      // High risk checks
      const risk = (scenario as any).riskLevel?.toUpperCase().trim();
      const isHighOrCritical = risk === 'HIGH' || risk === 'CRITICAL';
      if (isHighOrCritical && !types.has('SECURITY') && !types.has('EDGE_CASE')) {
        blockingReasons.push(`Scenario "${scenario.scenarioName}" is high/critical risk but lacks a SECURITY or EDGE_CASE test case.`);
      }
    }

    // 2. Traceability validation check
    const invalidOrigins = testCases.filter(
      tc =>
        !tc.testCaseOrigin.featureIds ||
        tc.testCaseOrigin.featureIds.length === 0 ||
        !tc.testCaseOrigin.workflowIds ||
        tc.testCaseOrigin.workflowIds.length === 0
    );
    if (invalidOrigins.length > 0) {
      blockingReasons.push(`${invalidOrigins.length} test cases contain empty or unmapped feature/workflow origins.`);
    }

    // 3. Schema validation verification
    for (const tc of testCases) {
      try {
        TestCaseSchema.parse(tc);
      } catch (err: any) {
        blockingReasons.push(`Zod contract validation failed on test case "${tc.testCaseName}": ${err.message}`);
      }
    }

    return {
      ready: blockingReasons.length === 0,
      blockingReasons
    };
  }
}
