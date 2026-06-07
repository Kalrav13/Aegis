import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  ScenarioDiscoveryContext,
  Scenario,
  ScenarioQualityScorecard,
  ScenarioQualityScore,
  ScenarioQualityScorecardSchema
} from '@testlens/contracts';

@Injectable()
export class ScenarioQualityEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates the quality of all discovered scenarios deterministically and using the isolated AI Critic, 
   * aggregates them into a scorecard, checks readiness gates, and enforces evaluation versioning.
   */
  public async evaluate(
    scenarios: Scenario[],
    context: ScenarioDiscoveryContext
  ): Promise<ScenarioQualityScorecard> {
    if (scenarios.length === 0) {
      return {
        evaluationVersion: "1.0.0",
        overallScenarioQualityScore: 100,
        totalScenariosEvaluated: 0,
        passingScenariosCount: 0,
        failingScenariosCount: 0,
        scenariosEvaluations: [],
        scenarioGenerationReadiness: {
          ready: false,
          blockingReasons: ['No scenarios discovered to evaluate.']
        },
        globalWarnings: ['No scenarios discovered to evaluate.']
      };
    }

    // 1. Run AI Critic for semantic QA usefulness review (AI Critic Isolation)
    const criticRatings = await this.runLlmCritic(scenarios);

    // 2. Compute individual scenario quality metrics
    const evaluations: ScenarioQualityScore[] = scenarios.map(scenario => {
      const critic = criticRatings.get(scenario.scenarioName) || {
        completenessScore: 75,
        warnings: ['[LLM Critic fell back to default rating]']
      };

      return this.evaluateScenario(scenario, context, critic);
    });

    // 3. Compile overall scorecard and evaluate readiness gates
    const scorecard = this.buildScorecard(evaluations);

    // 4. Validate output matches contract schema
    return ScenarioQualityScorecardSchema.parse(scorecard);
  }

  /**
   * Scores a single scenario using deterministic metrics and the isolated AI critic score.
   */
  private evaluateScenario(
    scenario: Scenario,
    context: ScenarioDiscoveryContext,
    critic: { completenessScore: number; warnings: string[] }
  ): ScenarioQualityScore {
    const warnings: string[] = [];

    // --- A. Completeness Score (20% - AI Critic Isolated) ---
    let deterministicCompleteness = 100;
    const descLen = scenario.description.length;
    if (descLen < 10) {
      deterministicCompleteness = 50;
      warnings.push(`Scenario description is too short (under 10 characters).`);
    } else if (descLen < 50) {
      deterministicCompleteness = 70;
      warnings.push(`Scenario description is brief (under 50 characters).`);
    } else if (descLen < 100) {
      deterministicCompleteness = 85;
      warnings.push(`Scenario description is somewhat short (under 100 characters).`);
    }

    const completenessScore = Math.round((deterministicCompleteness * 0.5) + (critic.completenessScore * 0.5));
    critic.warnings.forEach(w => warnings.push(w));

    // --- B. Evidence Coverage Score (15%) ---
    let baseEvidenceScore = 100;
    const evidenceCount = scenario.evidence.length;
    if (evidenceCount === 1) {
      baseEvidenceScore = 70;
    } else if (evidenceCount === 2) {
      baseEvidenceScore = 85;
    } else if (evidenceCount === 0) {
      baseEvidenceScore = 0;
    }

    // Grounding check
    const validAssets = new Set<string>();
    const gatherAssets = (list?: string[]) => {
      if (list) list.forEach(c => validAssets.add(c.toLowerCase().trim()));
    };
    gatherAssets(context.candidateAssets.routes);
    gatherAssets(context.candidateAssets.apis);
    gatherAssets(context.candidateAssets.forms);

    let invalidCount = 0;
    for (const path of scenario.evidence) {
      const normPath = path.toLowerCase().trim();
      let matched = validAssets.has(normPath);
      if (!matched) {
        for (const cand of validAssets) {
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
      warnings.push(`Scenario contains ${invalidCount} ungrounded evidence paths.`);
    }
    const evidenceCoverageScore = Math.max(0, baseEvidenceScore - (invalidCount * 40));

    // --- C. Workflow Coverage Score (15%) ---
    let baseWorkflowScore = 100;
    const wfCount = scenario.sourceWorkflows.length;
    if (wfCount === 0) {
      baseWorkflowScore = 0;
    } else if (wfCount === 1) {
      baseWorkflowScore = 80;
    }

    // Overlap check
    let overlapCount = 0;
    if (wfCount > 0) {
      const lowercasedWfNames = new Set(scenario.sourceWorkflows.map(w => w.toLowerCase().trim()));
      const workflowEvidence = new Set<string>();

      (context.workflowSummary || []).forEach(wf => {
        if (lowercasedWfNames.has(wf.name.toLowerCase().trim())) {
          (wf.evidence || []).forEach(e => workflowEvidence.add(e.toLowerCase().trim()));
        }
      });

      for (const path of scenario.evidence) {
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

      if (overlapCount === 0 && scenario.evidence.length > 0) {
        baseWorkflowScore = Math.max(0, baseWorkflowScore - 20);
        warnings.push(`Scenario has zero evidence overlap with its mapped workflows.`);
      }
    }
    const workflowCoverageScore = baseWorkflowScore;

    // --- D. Priority Validity Score (10%) ---
    let priorityValidityScore = 100;
    const scenarioNameLower = scenario.scenarioName.toLowerCase();
    const scenarioDescLower = scenario.description.toLowerCase();
    
    const sensitiveTokens = [
      'auth', 'login', 'signup', 'mfa', 'permission', 'role', 'session',
      'pay', 'bill', 'checkout', 'stripe', 'card', 'transaction'
    ];
    const isSensitive = sensitiveTokens.some(tok => scenarioNameLower.includes(tok) || scenarioDescLower.includes(tok));

    if (isSensitive) {
      const priorityNorm = scenario.priority.toUpperCase().trim();
      if (priorityNorm === 'MEDIUM' || priorityNorm === 'LOW') {
        priorityValidityScore = Math.max(0, priorityValidityScore - 40);
        warnings.push(`Scenario covers sensitive flow but priority is set to ${scenario.priority}.`);
      }
    }

    // Verify parent feature risk impact
    const lowercasedParents = new Set(scenario.parentFeatures.map(p => p.toLowerCase().trim()));
    const parentFeaturesList = context.featureSummary.filter(f => lowercasedParents.has(f.featureName.toLowerCase().trim()));
    const hasHighRiskParent = parentFeaturesList.some(f => {
      const risk = f.riskLevel.toUpperCase().trim();
      return risk === 'HIGH' || risk === 'CRITICAL';
    });

    if (hasHighRiskParent) {
      const priorityNorm = scenario.priority.toUpperCase().trim();
      if (priorityNorm === 'LOW') {
        priorityValidityScore = Math.max(0, priorityValidityScore - 30);
        warnings.push(`Scenario maps to high/critical risk parent feature but priority is set to LOW.`);
      }
    }

    // --- E. Risk Validity Score (10%) ---
    let riskClassificationScore = 100;
    if (parentFeaturesList.length > 0) {
      const getRiskValue = (risk: string) => {
        const norm = risk.toUpperCase().trim();
        if (norm === 'CRITICAL') return 4;
        if (norm === 'HIGH') return 3;
        if (norm === 'MEDIUM') return 2;
        return 1;
      };

      const maxParentRiskVal = Math.max(...parentFeaturesList.map(f => getRiskValue(f.riskLevel)));
      const scenarioRiskVal = getRiskValue(scenario.riskLevel);

      if (scenarioRiskVal < maxParentRiskVal) {
        riskClassificationScore = Math.max(0, riskClassificationScore - 40);
        warnings.push(`Scenario risk level (${scenario.riskLevel}) is lower than its parent features risk level.`);
      }
    }

    // --- F. Traceability Quality Score (10%) ---
    let traceabilityQualityScore = 100;
    const origin = scenario.scenarioOrigin;
    if (!origin) {
      traceabilityQualityScore = 0;
      warnings.push(`Scenario has no traceability scenarioOrigin metadata.`);
    } else {
      if (!origin.featureIds || origin.featureIds.length === 0) {
        traceabilityQualityScore = Math.max(0, traceabilityQualityScore - 50);
        warnings.push(`Scenario traceability is missing parent feature IDs.`);
      }
      if (!origin.workflowIds || origin.workflowIds.length === 0) {
        traceabilityQualityScore = Math.max(0, traceabilityQualityScore - 50);
        warnings.push(`Scenario traceability is missing workflow IDs.`);
      }
      if (scenario.parentFeatures.length !== (origin.featureIds?.length || 0)) {
        traceabilityQualityScore = Math.max(0, traceabilityQualityScore - 20);
        warnings.push(`Parent features count does not match feature IDs count in scenarioOrigin.`);
      }
      if (scenario.sourceWorkflows.length !== (origin.workflowIds?.length || 0)) {
        traceabilityQualityScore = Math.max(0, traceabilityQualityScore - 20);
        warnings.push(`Source workflows count does not match workflow IDs count in scenarioOrigin.`);
      }
    }

    // --- G. Coverage Target Quality Score (10%) ---
    let coverageTargetScore = 100;
    const targets = scenario.coverageTargets;
    if (!targets) {
      coverageTargetScore = 0;
      warnings.push(`Scenario has no coverage targets.`);
    } else {
      const density = (targets.routes?.length || 0) + (targets.apis?.length || 0) + (targets.forms?.length || 0);
      if (density === 0) {
        coverageTargetScore = 0;
        warnings.push(`Scenario coverage targets are completely empty.`);
      } else if (density === 1) {
        coverageTargetScore = 70;
      } else if (density === 2) {
        coverageTargetScore = 85;
      }
    }

    // --- H. Confidence Reliability Score (10%) ---
    let confidenceReliabilityScore = 100;
    if (scenario.confidenceScore === 1.0 && evidenceCount < 3) {
      confidenceReliabilityScore = Math.max(0, confidenceReliabilityScore - 30);
      warnings.push(`Scenario has maximum confidence (1.0) but has minimal evidence (< 3 files).`);
    } else if (scenario.confidenceScore >= 0.9 && evidenceCount < 2) {
      confidenceReliabilityScore = Math.max(0, confidenceReliabilityScore - 15);
      warnings.push(`Scenario has high confidence but has minimal evidence (< 2 files).`);
    }

    const hasCriticalParent = parentFeaturesList.some(f => f.riskLevel.toUpperCase().trim() === 'CRITICAL');
    if (hasCriticalParent && scenario.confidenceScore < 0.6) {
      confidenceReliabilityScore = Math.max(0, confidenceReliabilityScore - 20);
      warnings.push(`Scenario is mapping to a CRITICAL feature but has low confidence score (${scenario.confidenceScore}).`);
    }

    // --- Composite Quality Score (Weighted Sum) ---
    const qualityScore = Math.round(
      (completenessScore * 0.20) +
      (evidenceCoverageScore * 0.15) +
      (workflowCoverageScore * 0.15) +
      (priorityValidityScore * 0.10) +
      (riskClassificationScore * 0.10) +
      (traceabilityQualityScore * 0.10) +
      (coverageTargetScore * 0.10) +
      (confidenceReliabilityScore * 0.10)
    );

    return {
      scenarioId: scenario.scenarioId,
      qualityScore,
      completenessScore,
      evidenceCoverageScore,
      workflowCoverageScore,
      priorityValidityScore,
      riskClassificationScore,
      traceabilityQualityScore,
      coverageTargetScore,
      confidenceReliabilityScore,
      warnings
    };
  }

  /**
   * Calls Gemini critic to evaluate scenario business clarity and QA usefulness (Isolated AI Critic).
   */
  private async runLlmCritic(
    scenarios: Scenario[]
  ): Promise<Map<string, { completenessScore: number; warnings: string[] }>> {
    const ratings = new Map<string, { completenessScore: number; warnings: string[] }>();

    const prompt = `
You are a Lead QA Architect auditing discovered business-level QA scenarios.
Your task is to analyze each scenario description, critic its clarity, and rate its usefulness for test case generation.
Provide a completeness score between 0 and 100. Lower scores should be assigned if the description is vague or lacks context.

=== DISCOVERED SCENARIOS ===
${JSON.stringify(
  scenarios.map(s => ({
    name: s.scenarioName,
    description: s.description
  })),
  null,
  2
)}

=== OUTPUT SCHEMA ===
You MUST return a JSON object conforming exactly to:
{
  "evaluations": [
    {
      "scenarioName": "<exact name of scenario>",
      "completenessScore": <number between 0 and 100>,
      "warnings": [
        "<actionable criticism, if any: e.g. 'Scenario description lacks concrete expected results' or 'Generic happy path description'>"
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

          ratings.set(item.scenarioName, { completenessScore, warnings });
        }
      }
    } catch (error: any) {
      console.warn('Scenario Critic Layer call failed, defaulting completeness rating:', error.message);
    }

    return ratings;
  }

  /**
   * Compiles individual ratings into the aggregate scorecard and runs readiness gates.
   */
  private buildScorecard(evaluations: ScenarioQualityScore[]): ScenarioQualityScorecard {
    const totalScenariosEvaluated = evaluations.length;
    if (totalScenariosEvaluated === 0) {
      return {
        evaluationVersion: "1.0.0",
        overallScenarioQualityScore: 100,
        totalScenariosEvaluated: 0,
        passingScenariosCount: 0,
        failingScenariosCount: 0,
        scenariosEvaluations: [],
        scenarioGenerationReadiness: {
          ready: false,
          blockingReasons: ['No scenarios evaluated.']
        },
        globalWarnings: []
      };
    }

    const sumScore = evaluations.reduce((sum, curr) => sum + curr.qualityScore, 0);
    const overallScenarioQualityScore = Math.round(sumScore / totalScenariosEvaluated);

    const passingScenariosCount = evaluations.filter(e => e.qualityScore >= 70).length;
    const failingScenariosCount = totalScenariosEvaluated - passingScenariosCount;
    const failingRatio = failingScenariosCount / totalScenariosEvaluated;

    // Evaluate readiness gate rules
    const blockingReasons: string[] = [];
    if (overallScenarioQualityScore < 70) {
      blockingReasons.push(
        `Overall scenario quality score of ${overallScenarioQualityScore} is below the threshold of 70.`
      );
    }

    const severelyFailingScenarios = evaluations.filter(e => e.qualityScore < 50);
    if (severelyFailingScenarios.length > 0) {
      blockingReasons.push(
        `${severelyFailingScenarios.length} scenario(s) fall below the minimum allowed cap of 50.`
      );
    }

    if (failingRatio >= 0.3) {
      blockingReasons.push(
        `${(failingRatio * 100).toFixed(0)}% of scenarios failed the quality gate (maximum allowed failure rate is 30%).`
      );
    }

    const scenarioGenerationReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    const globalWarningsSet = new Set<string>();
    evaluations.forEach(e => {
      e.warnings.forEach(w => globalWarningsSet.add(w));
    });

    return {
      evaluationVersion: "1.0.0",
      overallScenarioQualityScore,
      totalScenariosEvaluated,
      passingScenariosCount,
      failingScenariosCount,
      scenariosEvaluations: evaluations,
      scenarioGenerationReadiness,
      globalWarnings: Array.from(globalWarningsSet)
    };
  }
}
