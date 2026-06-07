import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  DiscoveryContext,
  FeatureQualityScore,
  FeatureQualityScorecard,
  FeatureQualityScorecardSchema
} from '@testlens/contracts';

interface FeatureInput {
  id: string;
  featureName: string;
  featureType: 'CORE' | 'SUPPORTING' | 'ADMINISTRATIVE' | 'INTEGRATION';
  description: string;
  confidenceScore: number;
  evidence: string[];
  sourceWorkflows: string[];
  riskLevel: string;
}

@Injectable()
export class FeatureQualityEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates the quality, completeness, and reliability of discovered features.
   */
  public async evaluate(
    features: FeatureInput[],
    discoveryContext: DiscoveryContext
  ): Promise<FeatureQualityScorecard> {
    if (features.length === 0) {
      return {
        overallQualityScore: 100,
        totalFeaturesEvaluated: 0,
        passingFeaturesCount: 0,
        failingFeaturesCount: 0,
        featuresEvaluations: [],
        globalWarnings: ['No features discovered to evaluate.']
      };
    }

    // 1. Run AI Critic for semantic completeness review
    const criticRatings = await this.runLlmCritic(features, discoveryContext);

    // 2. Compute individual feature quality metrics
    const evaluations: FeatureQualityScore[] = features.map(feature => {
      const critic = criticRatings.get(feature.featureName) || {
        completenessScore: 75,
        warnings: ['[LLM Critic fell back to default rating]']
      };

      return this.evaluateFeature(feature, discoveryContext, critic);
    });

    // 3. Compile overall run scorecard
    const scorecard = this.buildScorecard(evaluations);

    // 4. Validate output matches contract schema
    return FeatureQualityScorecardSchema.parse(scorecard);
  }

  /**
   * Calculates sub-scores and compiles warnings for a single feature.
   */
  private evaluateFeature(
    feature: FeatureInput,
    context: DiscoveryContext,
    critic: { completenessScore: number; warnings: string[] }
  ): FeatureQualityScore {
    const warnings: string[] = [];

    // --- A. Completeness Score (30%) ---
    let deterministicCompleteness = 100;
    const descLen = feature.description.length;
    if (descLen < 50) {
      deterministicCompleteness = 70;
      warnings.push(`Feature "${feature.featureName}" description is too short (under 50 characters).`);
    } else if (descLen < 100) {
      deterministicCompleteness = 85;
      warnings.push(`Feature "${feature.featureName}" description is brief (under 100 characters).`);
    }

    const completenessScore = Math.round((deterministicCompleteness * 0.5) + (critic.completenessScore * 0.5));
    critic.warnings.forEach(w => warnings.push(w));

    // --- B. Evidence Coverage Score (20%) ---
    let baseEvidenceScore = 100;
    const evidenceCount = feature.evidence.length;
    if (evidenceCount === 1) {
      baseEvidenceScore = 70;
    } else if (evidenceCount === 2) {
      baseEvidenceScore = 85;
    }

    // Grounding check
    const validCandidates = new Set<string>();
    const gatherCandidates = (list?: string[]) => {
      if (list) list.forEach(c => validCandidates.add(c.toLowerCase().trim()));
    };
    gatherCandidates(context.discoveryCandidates.routes);
    gatherCandidates(context.discoveryCandidates.apis);
    gatherCandidates(context.discoveryCandidates.forms);
    gatherCandidates(context.discoveryCandidates.components);

    let invalidCount = 0;
    for (const path of feature.evidence) {
      const normPath = path.toLowerCase().trim();
      let matched = validCandidates.has(normPath);
      if (!matched) {
        for (const cand of validCandidates) {
          if (cand.endsWith(normPath) || normPath.endsWith(cand)) {
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        invalidCount++;
      }
    }

    if (invalidCount > 0) {
      warnings.push(`Feature "${feature.featureName}" contains ${invalidCount} ungrounded evidence paths.`);
    }
    const evidenceCoverageScore = Math.max(0, baseEvidenceScore - (invalidCount * 40));

    // --- C. Workflow Coverage Score (20%) ---
    let baseWorkflowScore = 100;
    const wfCount = feature.sourceWorkflows.length;
    if (wfCount === 0) {
      baseWorkflowScore = 0;
    } else if (wfCount === 1) {
      baseWorkflowScore = 80;
    }

    // Asset overlap check
    let overlapCount = 0;
    if (wfCount > 0) {
      const lowercasedWfNames = new Set(feature.sourceWorkflows.map(w => w.toLowerCase().trim()));
      const workflowEvidence = new Set<string>();

      (context.aggregatedWorkflows || []).forEach(wf => {
        if (lowercasedWfNames.has(wf.name.toLowerCase().trim())) {
          (wf.evidence || []).forEach(e => workflowEvidence.add(e.toLowerCase().trim()));
        }
      });

      for (const path of feature.evidence) {
        const normPath = path.toLowerCase().trim();
        let matched = workflowEvidence.has(normPath);
        if (!matched) {
          for (const we of workflowEvidence) {
            if (we.endsWith(normPath) || normPath.endsWith(we)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          overlapCount++;
        }
      }

      if (overlapCount === 0 && feature.evidence.length > 0) {
        baseWorkflowScore = Math.max(0, baseWorkflowScore - 20);
        warnings.push(`Feature "${feature.featureName}" has zero evidence overlap with its mapped workflows.`);
      }
    }

    const workflowCoverageScore = baseWorkflowScore;

    // --- D. Confidence Reliability Score (15%) ---
    let confidenceDeductions = 0;
    if (feature.confidenceScore === 1.0 && evidenceCount < 3) {
      confidenceDeductions += 30;
      warnings.push(`Feature "${feature.featureName}" has maximum confidence (1.0) but has minimal evidence (< 3 files).`);
    } else if (feature.confidenceScore >= 0.9 && evidenceCount < 2) {
      confidenceDeductions += 15;
      warnings.push(`Feature "${feature.featureName}" has high confidence but has minimal evidence (< 2 files).`);
    }

    if (feature.confidenceScore < 0.6 && feature.featureType === 'CORE') {
      confidenceDeductions += 20;
      warnings.push(`Feature "${feature.featureName}" is CORE but has low confidence score (${feature.confidenceScore}).`);
    }

    const confidenceReliabilityScore = Math.max(0, 100 - confidenceDeductions);

    // --- E. Risk Classification Score (15%) ---
    let riskDeductions = 0;
    const lowercasedWfNames = new Set(feature.sourceWorkflows.map(w => w.toLowerCase().trim()));
    const riskProfiles = context.riskProfile || [];
    const isHighRiskWorkflow = riskProfiles.some(rp => lowercasedWfNames.has(rp.name.toLowerCase().trim()));

    if (isHighRiskWorkflow) {
      const riskNorm = feature.riskLevel.toUpperCase().trim();
      if (riskNorm === 'LOW' || riskNorm === 'MEDIUM') {
        riskDeductions += 45;
        warnings.push(`Feature "${feature.featureName}" is tied to high-risk workflows but is classified as ${feature.riskLevel}.`);
      }
    }

    // Sensitive route validation
    const sensitiveTokens = ['billing', 'payment', 'checkout', 'credit card', 'auth', 'login', 'admin', 'stripe'];
    const hasSensitiveAssets = feature.evidence.some(e => {
      const norm = e.toLowerCase();
      return sensitiveTokens.some(tok => norm.includes(tok));
    });

    if (hasSensitiveAssets) {
      const riskNorm = feature.riskLevel.toUpperCase().trim();
      if (riskNorm === 'LOW' || riskNorm === 'MEDIUM') {
        riskDeductions += 30;
        warnings.push(`Feature "${feature.featureName}" covers sensitive assets but risk level is set to ${feature.riskLevel}.`);
      }
    }

    const riskClassificationScore = Math.max(0, 100 - riskDeductions);

    // --- Overall Composite Score ---
    const qualityScore = Math.round(
      (completenessScore * 0.3) +
      (evidenceCoverageScore * 0.2) +
      (workflowCoverageScore * 0.2) +
      (confidenceReliabilityScore * 0.15) +
      (riskClassificationScore * 0.15)
    );

    return {
      featureId: feature.id,
      qualityScore,
      completenessScore,
      evidenceCoverageScore,
      workflowCoverageScore,
      confidenceReliabilityScore,
      riskClassificationScore,
      warnings
    };
  }

  /**
   * Evaluates quality descriptions using LLM semantic review.
   */
  private async runLlmCritic(
    features: FeatureInput[],
    context: DiscoveryContext
  ): Promise<Map<string, { completenessScore: number; warnings: string[] }>> {
    const ratings = new Map<string, { completenessScore: number; warnings: string[] }>();

    const prompt = `
You are a Principal Product Analyst and QA Lead auditing a list of discovered business features.
Your job is to criticize each feature description and rate its business clarity.
Specifically, penalize features that are "shallow" (e.g. they merely name a single REST endpoint or UI component instead of representing a real user-facing business capability).

=== INGESTION DISCOVERY CONTEXT ===
- Purpose: ${context.applicationSummary.purpose}
- Business Domains: ${JSON.stringify(context.applicationSummary.businessDomains)}

=== DISCOVERED FEATURES ===
${JSON.stringify(
  features.map(f => ({
    name: f.featureName,
    type: f.featureType,
    description: f.description
  })),
  null,
  2
)}

=== OUTPUT SCHEMA ===
You MUST return a JSON object conforming exactly to:
{
  "evaluations": [
    {
      "featureName": "<exact name of feature>",
      "completenessScore": <number between 0 and 100 assessing description detail and business-level modeling depth>,
      "warnings": [
        "<actionable criticism: e.g. 'Feature description lacks target audience' or 'Shallow technical component representation'>"
      ]
    }
  ]
}
`;

    try {
      const result = await this.aiService.generateJson(prompt);
      const parsed = JSON.parse(result);
      if (parsed && Array.isArray(parsed.evaluations)) {
        for (const item of parsed.evaluations) {
          const completenessScore = typeof item.completenessScore === 'number'
            ? Math.min(100, Math.max(0, item.completenessScore))
            : 75;

          const warnings = Array.isArray(item.warnings)
            ? item.warnings.map((w: any) => `[LLM Critic] ${String(w).trim()}`)
            : [];

          ratings.set(item.featureName, { completenessScore, warnings });
        }
      }
    } catch (error: any) {
      console.warn('Feature Critic Layer call failed, defaulting completeness rating:', error.message);
    }

    return ratings;
  }

  /**
   * Compiles individual feature metrics into the aggregate scorecard.
   */
  private buildScorecard(evaluations: FeatureQualityScore[]): FeatureQualityScorecard {
    const totalFeaturesEvaluated = evaluations.length;
    if (totalFeaturesEvaluated === 0) {
      return {
        overallQualityScore: 100,
        totalFeaturesEvaluated: 0,
        passingFeaturesCount: 0,
        failingFeaturesCount: 0,
        featuresEvaluations: [],
        globalWarnings: []
      };
    }

    const sumScore = evaluations.reduce((sum, curr) => sum + curr.qualityScore, 0);
    const overallQualityScore = Math.round(sumScore / totalFeaturesEvaluated);

    const passingFeaturesCount = evaluations.filter(e => e.qualityScore >= 70).length;
    const failingFeaturesCount = totalFeaturesEvaluated - passingFeaturesCount;

    const globalWarningsSet = new Set<string>();
    evaluations.forEach(e => {
      e.warnings.forEach(w => globalWarningsSet.add(w));
    });

    return {
      overallQualityScore,
      totalFeaturesEvaluated,
      passingFeaturesCount,
      failingFeaturesCount,
      featuresEvaluations: evaluations,
      globalWarnings: Array.from(globalWarningsSet)
    };
  }
}
