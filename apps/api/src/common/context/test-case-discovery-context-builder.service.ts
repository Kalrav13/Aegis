import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import {
  TestCaseDiscoveryContext,
  ScenarioQualityScorecard,
  validateTestCaseDiscoveryContext
} from '@testlens/contracts';

export interface ScenarioInput {
  id: string;
  scenarioName: string;
  scenarioType: string;
  priority: string;
  description: string;
  evidence: string[] | any;
  sourceWorkflows: string[] | any;
  coverageTargets: {
    routes: string[];
    apis: string[];
    forms: string[];
  } | any;
  qualityScore: number | null;
  confidenceScore: number;
  riskLevel: string;
  scenarioOrigin?: any;
}

export interface CandidateAssetsInput {
  routes?: string[];
  apis?: string[];
  forms?: string[];
}

@Injectable()
export class TestCaseDiscoveryContextBuilderService {
  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * Deterministically aggregates scenario outputs, quality evaluations, and codebase candidate assets
   * into a token-optimized TestCaseDiscoveryContext.
   */
  public buildContext(
    scenarios: ScenarioInput[],
    scenarioQualityScorecard: ScenarioQualityScorecard | null,
    candidateAssets: CandidateAssetsInput
  ): TestCaseDiscoveryContext {
    // 1. Path normalization helper
    const normalizePathCasing = (path: string): string => {
      const trimmed = path.trim();
      const apiMatch = trimmed.match(/^(get|post|put|delete|patch|options|head)\s+(.+)$/i);
      if (apiMatch) {
        return `${apiMatch[1].toUpperCase()} ${apiMatch[2].toLowerCase()}`;
      }
      return trimmed.toLowerCase();
    };

    // 2. Trim description helper
    const trimDescription = (desc: string): string => {
      if (!desc) return '';
      const trimmed = desc.trim();
      if (trimmed.length > 500) {
        return trimmed.substring(0, 497) + '...';
      }
      return trimmed;
    };

    // 3. Selection / Token-Optimization: max 15 scenarios per feature
    const RISK_ORDER: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };

    const scenariosByFeature = new Map<string, ScenarioInput[]>();
    for (const scenario of scenarios) {
      const featureIds = scenario.scenarioOrigin?.featureIds;
      if (Array.isArray(featureIds) && featureIds.length > 0) {
        for (const fid of featureIds) {
          if (!scenariosByFeature.has(fid)) {
            scenariosByFeature.set(fid, []);
          }
          scenariosByFeature.get(fid)!.push(scenario);
        }
      } else {
        const fallbackId = 'unmapped';
        if (!scenariosByFeature.has(fallbackId)) {
          scenariosByFeature.set(fallbackId, []);
        }
        scenariosByFeature.get(fallbackId)!.push(scenario);
      }
    }

    const selectedScenarioIds = new Set<string>();
    for (const [, list] of scenariosByFeature.entries()) {
      const sorted = [...list].sort((a, b) => {
        // Quality Score (highest first)
        const qA = a.qualityScore ?? 0;
        const qB = b.qualityScore ?? 0;
        if (qB !== qA) return qB - qA;

        // Confidence Score (highest first)
        const cA = a.confidenceScore ?? 0;
        const cB = b.confidenceScore ?? 0;
        if (cB !== cA) return cB - cA;

        // Risk Level (highest first)
        const rA = RISK_ORDER[a.riskLevel?.toUpperCase()] ?? 0;
        const rB = RISK_ORDER[b.riskLevel?.toUpperCase()] ?? 0;
        return rB - rA;
      });

      const top15 = sorted.slice(0, 15);
      for (const s of top15) {
        selectedScenarioIds.add(s.id);
      }
    }

    // 4. Aggregate and clean scenarios
    const optimizedScenarios = scenarios
      .filter(s => selectedScenarioIds.has(s.id))
      .map(s => {
        const rawEvidence = Array.isArray(s.evidence) ? s.evidence : [];
        const cleanEvidence = Array.from<string>(
          new Set<string>(
            rawEvidence
              .map((e: any) => typeof e === 'string' ? normalizePathCasing(e) : '')
              .filter((e: string) => e.length > 0)
          )
        );

        const rawWorkflows = Array.isArray(s.sourceWorkflows) ? s.sourceWorkflows : [];
        const cleanWorkflows = Array.from<string>(
          new Set<string>(
            rawWorkflows
              .map((w: any) => typeof w === 'string' ? w.trim() : '')
              .filter((w: string) => w.length > 0)
          )
        );

        const rawTargets = s.coverageTargets || {};
        const cleanTargets = {
          routes: Array.from<string>(
            new Set<string>(
              (Array.isArray(rawTargets.routes) ? rawTargets.routes : [])
                .map((r: any) => typeof r === 'string' ? normalizePathCasing(r) : '')
                .filter((r: string) => r.length > 0)
            )
          ),
          apis: Array.from<string>(
            new Set<string>(
              (Array.isArray(rawTargets.apis) ? rawTargets.apis : [])
                .map((a: any) => typeof a === 'string' ? normalizePathCasing(a) : '')
                .filter((a: string) => a.length > 0)
            )
          ),
          forms: Array.from<string>(
            new Set<string>(
              (Array.isArray(rawTargets.forms) ? rawTargets.forms : [])
                .map((f: any) => typeof f === 'string' ? f.trim() : '')
                .filter((f: string) => f.length > 0)
            )
          )
        };

        return {
          id: s.id,
          scenarioName: s.scenarioName.trim(),
          scenarioType: s.scenarioType,
          priority: s.priority,
          description: trimDescription(s.description),
          evidence: cleanEvidence,
          sourceWorkflows: cleanWorkflows,
          coverageTargets: cleanTargets,
          qualityScore: s.qualityScore
        };
      });

    // 5. Aggregate and clean candidate assets
    const cleanRoutes = Array.from<string>(
      new Set<string>(
        (Array.isArray(candidateAssets?.routes) ? candidateAssets.routes : [])
          .map((r: any) => typeof r === 'string' ? normalizePathCasing(r) : '')
          .filter((r: string) => r.length > 0)
      )
    );
    const cleanApis = Array.from<string>(
      new Set<string>(
        (Array.isArray(candidateAssets?.apis) ? candidateAssets.apis : [])
          .map((a: any) => typeof a === 'string' ? normalizePathCasing(a) : '')
          .filter((a: string) => a.length > 0)
      )
    );
    const cleanForms = Array.from<string>(
      new Set<string>(
        (Array.isArray(candidateAssets?.forms) ? candidateAssets.forms : [])
          .map((f: any) => typeof f === 'string' ? f.trim() : '')
          .filter((f: string) => f.length > 0)
      )
    );

    const cleanCandidateAssets = {
      routes: cleanRoutes,
      apis: cleanApis,
      forms: cleanForms
    };

    // 6. Readiness Evaluator
    const blockingReasons: string[] = [];

    if (!scenarioQualityScorecard) {
      blockingReasons.push('Upstream scenario quality scorecard is missing.');
    } else {
      if (!scenarioQualityScorecard.scenarioGenerationReadiness?.ready) {
        const upstreamReasons = scenarioQualityScorecard.scenarioGenerationReadiness?.blockingReasons || [];
        blockingReasons.push(
          `Upstream scenario quality readiness is blocked: ${upstreamReasons.join('; ')}`
        );
      }
    }

    if (scenarios.length === 0) {
      blockingReasons.push('Scenario count is zero. No scenarios available for test case discovery.');
    }

    let averageQuality = 100;
    if (scenarios.length > 0) {
      const scoredScenarios = scenarios.filter(s => s.qualityScore !== null);
      if (scoredScenarios.length > 0) {
        const sum = scoredScenarios.reduce((acc, s) => acc + (s.qualityScore ?? 0), 0);
        averageQuality = sum / scoredScenarios.length;
      } else {
        averageQuality = 0;
      }
    }
    if (averageQuality < 70) {
      blockingReasons.push(`Average scenario quality score (${averageQuality.toFixed(1)}) is below the required threshold of 70.`);
    }

    let failingRatio = 0;
    if (scenarios.length > 0) {
      const failingCount = scenarios.filter(s => (s.qualityScore ?? 0) < 70).length;
      failingRatio = failingCount / scenarios.length;
    }
    if (failingRatio >= 0.3) {
      blockingReasons.push(`Scenario quality failure rate is ${(failingRatio * 100).toFixed(0)}% (threshold must be under 30%).`);
    }

    const testCaseReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    // 7. Assemble final context
    const context: TestCaseDiscoveryContext = {
      contextVersion: '1.0.0',
      builderMetadata: {
        generatedAt: new Date().toISOString(),
        scenariosCount: optimizedScenarios.length
      },
      scenarios: optimizedScenarios,
      candidateAssets: cleanCandidateAssets,
      testCaseReadiness
    };

    // 8. Validate against Zod schema
    return validateTestCaseDiscoveryContext(context);
  }
}
