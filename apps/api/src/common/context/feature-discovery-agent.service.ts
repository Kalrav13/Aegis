import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  DiscoveryContext,
  Feature,
  FeatureDiscoveryOutputSchema,
  validateFeatureDiscoveryOutput
} from '@testlens/contracts';

@Injectable()
export class FeatureDiscoveryAgentService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates the discovery context, queries Gemini, and yields grounded, validated business features.
   */
  public async discoverFeatures(discoveryContext: DiscoveryContext): Promise<Feature[]> {
    // 1. Enforce readiness gate validation
    if (!discoveryContext.discoveryReadiness.ready) {
      throw new Error(
        `Feature discovery is blocked: ${discoveryContext.discoveryReadiness.blockingReasons.join('; ')}`
      );
    }

    // 2. Build structured analysis prompt
    const prompt = this.buildDiscoveryPrompt(discoveryContext);

    // 3. Query the Gemini gateway in JSON mode
    const rawResult = await this.aiService.generateJson(prompt);

    // 4. Parse, validate, and sanitize the response
    return this.validateAndSanitize(rawResult, discoveryContext);
  }

  /**
   * Constructs the prompt template injecting optimized discovery context details.
   */
  private buildDiscoveryPrompt(context: DiscoveryContext): string {
    return `
You are an expert Principal Product Analyst and Lead QA Architect specializing in reverse-engineering system capabilities from codebase metadata.
Your goal is to analyze the provided Ingestion Discovery Context and identify the business-level capabilities (Features) of the application.

For every feature discovered, you must determine its classification (Type), connect it to the core workflows, assign a risk level, score your confidence, and ground it with physical evidence from the candidate lists.

=== SYSTEM RULES & CONSTRAINTS ===
1. Every feature must be grounded. The evidence array MUST only contain routes, apis, forms, or components listed under "discoveryCandidates" in the context.
2. Do not invent evidence paths or file locations. Doing so is considered a critical grounding failure.
3. Every feature must map to at least one workflow listed in the "aggregatedWorkflows" section.
4. Output MUST conform strictly to the specified JSON schema. Do not include markdown codeblocks or conversational text.

=== FEATURE CLASSIFICATION RULES ===
- CORE: Primary business flows driving the application's core value (e.g., Shopping Cart, Checkout, Course Registration, User Login).
- SUPPORTING: Secondary flows assisting core capabilities (e.g., Edit Profile, Password Reset, Notification Settings).
- ADMINISTRATIVE: Internal operations reserved for system administrators (e.g., User Moderation, Database Backups, Audit Logs).
- INTEGRATION: Interfaces connecting to external APIs or third-party service gateways (e.g., Stripe Webhooks, SendGrid Integration).

=== RISK ATTRIBUTION RULES ===
- CRITICAL: Features handling financial transactions, authentication mechanisms, or encryption configurations.
- HIGH: Complex data state mutations or file uploads.
- MEDIUM: Data listings, views, and simple mutations (e.g., CRUD settings).
- LOW: Static dashboard views, help documentation, or feedback portals.

=== CONFIDENCE SCORING RULES ===
- 1.0: Mapped to a core workflow, has >= 3 distinct routes/forms as evidence, and has a highly specific description.
- 0.8 - 0.9: Maps to a workflow and has 1 or 2 valid routes/forms as evidence.
- 0.5 - 0.7: Maps to supporting component files or files listed in unmapped assets, without direct workflow mapping.
- < 0.5: Ambiguous mappings or ungrounded paths. DO NOT emit features below 0.5.

=== INGESTION DISCOVERY CONTEXT ===
- Version: ${context.contextVersion}
- Quality Score: ${context.qualityGate.qualityScore}
- Purpose: ${context.applicationSummary.purpose}
- Business Domains: ${JSON.stringify(context.applicationSummary.businessDomains)}
- Target Users: ${JSON.stringify(context.applicationSummary.targetUsers)}

- Aggregated Core Workflows:
${JSON.stringify(context.aggregatedWorkflows, null, 2)}

- Risk Profile:
${JSON.stringify(context.riskProfile, null, 2)}

- Candidate Assets for Discovery:
  * Routes: ${JSON.stringify(context.discoveryCandidates.routes)}
  * APIs: ${JSON.stringify(context.discoveryCandidates.apis)}
  * Forms: ${JSON.stringify(context.discoveryCandidates.forms)}
  * Components: ${JSON.stringify(context.discoveryCandidates.components)}

=== OUTPUT SCHEMA ===
Return a JSON object conforming exactly to:
{
  "features": [
    {
      "featureName": "<Concise name of feature, e.g. Billing Portal>",
      "featureType": "CORE | SUPPORTING | ADMINISTRATIVE | INTEGRATION",
      "description": "<Detailed description of capabilities and QA testing relevance>",
      "confidenceScore": <number between 0.5 and 1.0>,
      "evidence": ["<candidate routes, apis, forms, or components cited>"],
      "sourceWorkflows": ["<exact core workflow name this feature associates with>"],
      "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL"
    }
  ]
}
`;
  }

  /**
   * Parses output, verifies evidence path grounding, filters out ungrounded features, and parses against Zod contract.
   */
  private validateAndSanitize(rawJson: string, context: DiscoveryContext): Feature[] {
    const parsedObj = JSON.parse(rawJson);
    const rawFeatures = Array.isArray(parsedObj.features) ? parsedObj.features : [];

    // Compile set of all valid discovery candidates
    const validCandidates = new Set<string>();
    if (context.discoveryCandidates.routes) {
      context.discoveryCandidates.routes.forEach(r => validCandidates.add(r.toLowerCase().trim()));
    }
    if (context.discoveryCandidates.apis) {
      context.discoveryCandidates.apis.forEach(a => validCandidates.add(a.toLowerCase().trim()));
    }
    if (context.discoveryCandidates.forms) {
      context.discoveryCandidates.forms.forEach(f => validCandidates.add(f.toLowerCase().trim()));
    }
    if (context.discoveryCandidates.components) {
      context.discoveryCandidates.components.forEach(c => validCandidates.add(c.toLowerCase().trim()));
    }

    const workflowNames = new Set<string>(
      (context.aggregatedWorkflows || []).map(w => w.name.toLowerCase().trim())
    );

    const sanitizedFeatures: any[] = [];

    for (const rawFeat of rawFeatures) {
      // 1. Evidence Grounding Check
      const evidence = Array.isArray(rawFeat.evidence) ? rawFeat.evidence : [];
      const validEvidence = evidence.filter((e: string) => {
        const norm = e.toLowerCase().trim();
        if (validCandidates.has(norm)) return true;
        for (const cand of validCandidates) {
          if (cand.endsWith(norm) || norm.endsWith(cand)) return true;
        }
        return false;
      });

      // Discard features with zero valid evidence paths
      if (validEvidence.length === 0) {
        console.warn(`Discarding inferred feature "${rawFeat.featureName}" because all cited evidence was ungrounded.`);
        continue;
      }

      // 2. Source Workflows Validation
      const sourceWorkflows = Array.isArray(rawFeat.sourceWorkflows) ? rawFeat.sourceWorkflows : [];
      const validWorkflows = sourceWorkflows.filter((sw: string) =>
        workflowNames.has(sw.toLowerCase().trim())
      );

      // Discard features with zero valid workflow links
      if (validWorkflows.length === 0) {
        console.warn(`Discarding inferred feature "${rawFeat.featureName}" because all cited workflows were invalid.`);
        continue;
      }

      // 3. Build sanitized feature object
      sanitizedFeatures.push({
        featureName: String(rawFeat.featureName || 'Unnamed Feature').trim(),
        featureType: rawFeat.featureType,
        description: String(rawFeat.description || '').trim(),
        confidenceScore: typeof rawFeat.confidenceScore === 'number' ? rawFeat.confidenceScore : 0.5,
        evidence: validEvidence,
        sourceWorkflows: validWorkflows,
        riskLevel: String(rawFeat.riskLevel || 'LOW').trim()
      });
    }

    // 4. Parse using Zod output schema to enforce contract validations
    const validatedOutput = validateFeatureDiscoveryOutput({ features: sanitizedFeatures });
    return validatedOutput.features;
  }
}
