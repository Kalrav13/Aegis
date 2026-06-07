import { Injectable } from '@nestjs/common';
import {
  DiscoveryContext,
  ScenarioDiscoveryContext,
  validateScenarioDiscoveryContext
} from '@testlens/contracts';

interface FeatureInput {
  id: string;
  featureName: string;
  featureType: string;
  description: string;
  confidenceScore: number;
  evidence: string[];
  sourceWorkflows: string[];
  riskLevel: string;
  qualityScore: number | null;
  qualityWarnings: string[];
}

@Injectable()
export class ScenarioDiscoveryContextBuilderService {
  constructor() {}

  /**
   * Deterministically aggregates ingested contexts, features, and scorecards into an AI-ready ScenarioDiscoveryContext.
   */
  public buildScenarioDiscoveryContext(
    features: FeatureInput[],
    discoveryContext: DiscoveryContext
  ): ScenarioDiscoveryContext {
    // 1. Application Summary
    const applicationSummary = {
      purpose: discoveryContext.applicationSummary?.purpose || '',
      targetUsers: discoveryContext.applicationSummary?.targetUsers || [],
      businessDomains: discoveryContext.applicationSummary?.businessDomains || []
    };

    // 2. Feature Summary
    const featureSummary = features.map(f => ({
      id: f.id,
      featureName: f.featureName,
      featureType: f.featureType,
      description: f.description,
      evidence: Array.isArray(f.evidence) ? f.evidence : [],
      sourceWorkflows: Array.isArray(f.sourceWorkflows) ? f.sourceWorkflows : [],
      riskLevel: f.riskLevel,
      qualityScore: typeof f.qualityScore === 'number' ? f.qualityScore : null,
      warnings: Array.isArray(f.qualityWarnings) ? f.qualityWarnings : []
    }));

    // 3. Workflow & Risk Summaries
    const workflowSummary = discoveryContext.aggregatedWorkflows || [];
    const riskSummary = discoveryContext.riskProfile || [];

    // 4. Evidence Summary
    const evidenceSummary = {
      totalEvidenceFiles: discoveryContext.evidenceSummary?.totalEvidenceFiles || 0,
      mappedEvidenceFiles: discoveryContext.evidenceSummary?.mappedEvidenceFiles || 0,
      unmappedEvidenceFiles: discoveryContext.evidenceSummary?.unmappedEvidenceFiles || 0
    };

    // 5. Candidate Assets
    const candidateAssets = {
      routes: discoveryContext.discoveryCandidates?.routes || [],
      apis: discoveryContext.discoveryCandidates?.apis || [],
      forms: discoveryContext.discoveryCandidates?.forms || [],
      components: discoveryContext.discoveryCandidates?.components || []
    };

    // 6. Readiness Evaluator
    const blockingReasons: string[] = [];

    if (!discoveryContext.discoveryReadiness.ready) {
      blockingReasons.push(
        `Upstream Feature Discovery readiness gate is blocked: ${discoveryContext.discoveryReadiness.blockingReasons.join('; ')}`
      );
    }

    if (features.length === 0) {
      blockingReasons.push('Feature summary is empty. No features discovered to build scenarios from.');
    }

    let averageQuality = 100;
    if (features.length > 0) {
      const totalQuality = features.reduce((sum, f) => sum + (f.qualityScore ?? 100), 0);
      averageQuality = totalQuality / features.length;
    }

    if (averageQuality < 70) {
      blockingReasons.push(`Average feature quality score of ${averageQuality.toFixed(1)} is below required threshold of 70.`);
    }

    if (features.length > 0) {
      const failedCount = features.filter(f => (f.qualityScore ?? 100) < 70).length;
      const failedRatio = failedCount / features.length;
      if (failedRatio >= 0.5) {
        blockingReasons.push(
          `${(failedRatio * 100).toFixed(0)}% of features have failed quality gates (threshold must be under 50%).`
        );
      }
    }

    const scenarioReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    // 7. Coverage Calculator
    const candidateRoutes = new Set(candidateAssets.routes.map(r => r.toLowerCase().trim()));
    const candidateApis = new Set(candidateAssets.apis.map(a => a.toLowerCase().trim()));
    const candidateForms = new Set(candidateAssets.forms.map(f => f.toLowerCase().trim()));

    const featureEvidence = new Set<string>();
    features.forEach(f => {
      if (Array.isArray(f.evidence)) {
        f.evidence.forEach(e => featureEvidence.add(e.toLowerCase().trim()));
      }
    });

    const getMatchCount = (candidates: Set<string>) => {
      let matches = 0;
      for (const cand of candidates) {
        let matched = featureEvidence.has(cand);
        if (!matched) {
          for (const fe of featureEvidence) {
            if (fe.endsWith(cand) || cand.endsWith(fe)) {
              matched = true;
              break;
            }
          }
        }
        if (matched) {
          matches++;
        }
      }
      return matches;
    };

    const matchedRoutes = getMatchCount(candidateRoutes);
    const matchedApis = getMatchCount(candidateApis);
    const matchedForms = getMatchCount(candidateForms);

    const calculateRatio = (matches: number, total: number) => {
      if (total === 0) return 100;
      const ratio = Math.round((matches / total) * 100);
      return Math.min(100, Math.max(0, ratio)); // Enforce range [0, 100]
    };

    const routeCoverageRatio = calculateRatio(matchedRoutes, candidateRoutes.size);
    const apiCoverageRatio = calculateRatio(matchedApis, candidateApis.size);
    const formCoverageRatio = calculateRatio(matchedForms, candidateForms.size);

    // Overall weighted coverage: RouteCoverage * 0.4 + ApiCoverage * 0.4 + FormCoverage * 0.2
    const overallCoverageRatio = Math.round(
      (routeCoverageRatio * 0.4) + (apiCoverageRatio * 0.4) + (formCoverageRatio * 0.2)
    );

    const coverageWarnings: string[] = [];
    if (overallCoverageRatio < 50) {
      coverageWarnings.push(
        `Low coverage of whitelisted codebase assets by features (${overallCoverageRatio}%); discovered scenarios may leave components untested.`
      );
    }

    const coverageSummary = {
      routeCoverageRatio,
      apiCoverageRatio,
      formCoverageRatio,
      overallCoverageRatio,
      warnings: coverageWarnings
    };

    // 8. Compile ScenarioDiscoveryContext payload
    const rawContext = {
      contextVersion: '1.0.0' as const,
      builderMetadata: {
        generatedAt: new Date().toISOString(),
        featuresCount: features.length
      },
      applicationSummary,
      featureSummary,
      workflowSummary,
      riskSummary,
      evidenceSummary,
      candidateAssets,
      scenarioReadiness,
      coverageSummary
    };

    // 9. Enforce schema validations
    return validateScenarioDiscoveryContext(rawContext);
  }
}
