import { Injectable } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import {
  TestCaseDiscoveryContext,
  TestCase,
  TestCaseQuality,
  TestCaseQualityScorecard,
  TestCaseQualityScorecardSchema
} from '@testlens/contracts';

@Injectable()
export class TestCaseQualityEvaluatorService {
  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluates all generated test cases against deterministic quality rules and isolated AI Critic reviews,
   * aggregates them into a scorecard, checks readiness gates, and enforces contract versioning.
   */
  public async evaluate(
    testCases: TestCase[],
    context: TestCaseDiscoveryContext
  ): Promise<TestCaseQualityScorecard> {
    if (testCases.length === 0) {
      return {
        evaluationVersion: "1.0.0",
        overallTestCaseQualityScore: 100,
        totalTestCasesEvaluated: 0,
        passingTestCasesCount: 0,
        failingTestCasesCount: 0,
        testCasesEvaluations: [],
        testCaseGenerationReadiness: {
          ready: false,
          blockingReasons: ['No test cases discovered to evaluate.']
        },
        globalWarnings: ['No test cases discovered to evaluate.']
      };
    }

    // 1. Run AI Critic for semantic step review (AI Critic Isolation)
    const criticRatings = await this.runLlmCritic(testCases);

    // 2. Compute individual test case quality metrics
    const evaluations: TestCaseQuality[] = testCases.map(tc => {
      const critic = criticRatings.get(tc.testCaseName) || {
        stepClarityScore: 75,
        expectedResultsScore: 75,
        semanticUsefulnessScore: 75,
        warnings: ['[LLM Critic fell back to default rating]']
      };

      return this.evaluateTestCase(tc, context, critic);
    });

    // 3. Compile overall scorecard and evaluate readiness gates
    const scorecard = this.buildScorecard(evaluations);

    // 4. Validate output matches contract schema
    return TestCaseQualityScorecardSchema.parse(scorecard);
  }

  /**
   * Scores a single test case using deterministic rules and LLM Critic inputs.
   */
  private evaluateTestCase(
    tc: TestCase,
    context: TestCaseDiscoveryContext,
    critic: {
      stepClarityScore: number;
      expectedResultsScore: number;
      semanticUsefulnessScore: number;
      warnings: string[];
    }
  ): TestCaseQuality {
    const warnings: string[] = [];

    // --- A. Completeness Score (25% - Averaged with AI usefulness) ---
    let deterministicCompleteness = 100;
    const descLen = tc.description ? tc.description.length : 0;
    
    if (descLen < 10) {
      deterministicCompleteness = Math.max(0, deterministicCompleteness - 50);
      warnings.push(`[LOW_COMPLETENESS] Description is too short (under 10 characters).`);
    }

    if (!tc.preconditions || tc.preconditions.length === 0) {
      deterministicCompleteness = Math.max(0, deterministicCompleteness - 30);
      warnings.push(`[LOW_COMPLETENESS] Preconditions are missing.`);
    }

    if (!tc.expectedResult || tc.expectedResult.trim().length === 0) {
      deterministicCompleteness = Math.max(0, deterministicCompleteness - 20);
      warnings.push(`[LOW_COMPLETENESS] Expected result is empty.`);
    }

    // Combine deterministic and AI Critic semantic usefulness score
    const completenessScore = Math.round((deterministicCompleteness * 0.5) + (critic.semanticUsefulnessScore * 0.5));

    // --- B. Grounding Score (25%) ---
    let groundingScore = 100;
    const whitelistRoutes = new Set(context.candidateAssets.routes.map(r => r.toLowerCase().trim()));
    const whitelistApis = new Set(context.candidateAssets.apis.map(a => a.toLowerCase().trim()));
    const whitelistForms = new Set(context.candidateAssets.forms.map(f => f.toLowerCase().trim()));
    const allWhitelist = new Set([...whitelistRoutes, ...whitelistApis, ...whitelistForms]);

    let invalidCount = 0;
    const evidenceList = tc.evidence || [];
    for (const ev of evidenceList) {
      const normEv = ev.toLowerCase().trim();
      let matched = allWhitelist.has(normEv);
      if (!matched) {
        for (const cand of allWhitelist) {
          if (cand.endsWith(normEv) || normEv.endsWith(cand)) {
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
      groundingScore = Math.max(0, groundingScore - (invalidCount * 30));
      warnings.push(`[LOW_GROUNDING] Test case contains ${invalidCount} ungrounded evidence paths.`);
    }

    // --- C. Traceability Score (25%) ---
    let traceabilityScore = 100;
    const origin = tc.testCaseOrigin;
    if (!origin) {
      traceabilityScore = 0;
      warnings.push(`[LOW_TRACEABILITY] Missing origin metadata.`);
    } else {
      let missingCount = 0;
      if (!origin.featureIds || origin.featureIds.length === 0) {
        missingCount++;
      }
      if (!origin.workflowIds || origin.workflowIds.length === 0) {
        missingCount++;
      }
      if (!origin.scenarioIds || origin.scenarioIds.length === 0) {
        missingCount++;
      }

      if (missingCount > 0) {
        traceabilityScore = Math.max(0, traceabilityScore - (missingCount * 30));
        warnings.push(`[LOW_TRACEABILITY] Missing parent mapping for ${missingCount} origin parameters.`);
      }
    }

    // --- D. Step Structure Score (25%) ---
    let stepStructureScore = 100;
    const steps = tc.steps || [];

    if (steps.length === 0) {
      stepStructureScore = 0;
      warnings.push(`[WEAK_STEP_STRUCTURE] Test case contains zero steps.`);
    } else {
      // Step Actions/Expectations (50 points)
      let invalidStepCount = 0;
      steps.forEach(s => {
        if (!s.action || s.action.trim().length === 0 || !s.expectedResult || s.expectedResult.trim().length === 0) {
          invalidStepCount++;
        }
      });
      if (invalidStepCount > 0) {
        stepStructureScore = Math.max(0, stepStructureScore - 50);
        warnings.push(`[WEAK_STEP_STRUCTURE] ${invalidStepCount} step(s) lack valid actions or expectations.`);
      }

      // Sequential Check (30 points)
      let sequenceValid = true;
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].stepNumber !== i + 1) {
          sequenceValid = false;
          break;
        }
      }
      if (!sequenceValid) {
        stepStructureScore = Math.max(0, stepStructureScore - 30);
        warnings.push(`[WEAK_STEP_STRUCTURE] Steps numbers are out of sequence.`);
      }

      // Step Density Check (20 points)
      if (steps.length < 3) {
        stepStructureScore = Math.max(0, stepStructureScore - 10);
        warnings.push(`[WEAK_STEP_STRUCTURE] Step count density is low (${steps.length} steps).`);
      }
    }

    // Incorporate AI Critic warnings
    critic.warnings.forEach(w => warnings.push(w));

    // Calculate composite quality score (Weighted equally: 25% each)
    const qualityScore = Math.round(
      (completenessScore * 0.25) +
      (groundingScore * 0.25) +
      (traceabilityScore * 0.25) +
      (stepStructureScore * 0.25)
    );

    return {
      testCaseId: tc.testCaseId,
      qualityScore,
      completenessScore,
      groundingScore,
      traceabilityScore,
      stepStructureScore,
      warnings
    };
  }

  /**
   * Invokes Gemini to evaluate step action logic, clarity, and expected results.
   */
  private async runLlmCritic(
    testCases: TestCase[]
  ): Promise<Map<string, { stepClarityScore: number; expectedResultsScore: number; semanticUsefulnessScore: number; warnings: string[] }>> {
    const ratings = new Map<string, { stepClarityScore: number; expectedResultsScore: number; semanticUsefulnessScore: number; warnings: string[] }>();

    const prompt = `
You are a Lead QA Engineer auditing manual test cases generated for an application.
Analyze the steps, clarity, and expected results of each test case.
Provide:
1. stepClarityScore (0-100): Is each step action clear and logical?
2. expectedResultsScore (0-100): Are expectations concrete and verifiable?
3. semanticUsefulnessScore (0-100): Is this test case high-quality and free of logic bugs?

=== TEST CASES ===
${JSON.stringify(
  testCases.map(tc => ({
    name: tc.testCaseName,
    description: tc.description,
    preconditions: tc.preconditions,
    steps: tc.steps.map(s => ({ step: s.stepNumber, action: s.action, expected: s.expectedResult })),
    expected: tc.expectedResult
  })),
  null,
  2
)}

=== OUTPUT SCHEMA ===
Return a JSON object conforming exactly to this structure:
{
  "evaluations": [
    {
      "testCaseName": "<exact test case name>",
      "stepClarityScore": <0-100>,
      "expectedResultsScore": <0-100>,
      "semanticUsefulnessScore": <0-100>,
      "warnings": [
        "<constructive criticism, e.g. '[LLM Critic] Step 2 lacks expected result context'>"
      ]
    }
  ]
}
`;

    try {
      const response = await this.aiService.generateJson(prompt);
      const parsed = JSON.parse(response);
      if (parsed && Array.isArray(parsed.evaluations)) {
        for (const item of parsed.evaluations) {
          const stepClarityScore = typeof item.stepClarityScore === 'number' ? item.stepClarityScore : 75;
          const expectedResultsScore = typeof item.expectedResultsScore === 'number' ? item.expectedResultsScore : 75;
          const semanticUsefulnessScore = typeof item.semanticUsefulnessScore === 'number' ? item.semanticUsefulnessScore : 75;
          const warnings = Array.isArray(item.warnings)
            ? item.warnings.map((w: any) => `[LLM Critic] ${String(w).trim()}`)
            : [];

          ratings.set(item.testCaseName, {
            stepClarityScore,
            expectedResultsScore,
            semanticUsefulnessScore,
            warnings
          });
        }
      }
    } catch (error: any) {
      console.warn('AI Critic evaluation failed, using fallback metrics:', error.message);
    }

    return ratings;
  }

  /**
   * Compiles individual scores into the aggregate scorecard and runs readiness gates.
   */
  private buildScorecard(evaluations: TestCaseQuality[]): TestCaseQualityScorecard {
    const totalTestCasesEvaluated = evaluations.length;
    if (totalTestCasesEvaluated === 0) {
      return {
        evaluationVersion: "1.0.0",
        overallTestCaseQualityScore: 100,
        totalTestCasesEvaluated: 0,
        passingTestCasesCount: 0,
        failingTestCasesCount: 0,
        testCasesEvaluations: [],
        testCaseGenerationReadiness: {
          ready: false,
          blockingReasons: ['No test cases evaluated.']
        },
        globalWarnings: []
      };
    }

    const sumScore = evaluations.reduce((sum, curr) => sum + curr.qualityScore, 0);
    const overallTestCaseQualityScore = Math.round(sumScore / totalTestCasesEvaluated);

    const passingTestCasesCount = evaluations.filter(e => e.qualityScore >= 70).length;
    const failingTestCasesCount = totalTestCasesEvaluated - passingTestCasesCount;
    const failingRatio = failingTestCasesCount / totalTestCasesEvaluated;

    // Evaluates readiness gate rules
    const blockingReasons: string[] = [];
    if (overallTestCaseQualityScore < 70) {
      blockingReasons.push(
        `Overall test case quality score of ${overallTestCaseQualityScore} is below the threshold of 70.`
      );
    }

    const severelyFailingCases = evaluations.filter(e => e.qualityScore < 50);
    if (severelyFailingCases.length > 0) {
      blockingReasons.push(
        `${severelyFailingCases.length} test case(s) fall below the minimum allowed cap of 50.`
      );
    }

    if (failingRatio >= 0.3) {
      blockingReasons.push(
        `${(failingRatio * 100).toFixed(0)}% of test cases failed the quality gate (maximum allowed failure rate is 30%).`
      );
    }

    const testCaseGenerationReadiness = {
      ready: blockingReasons.length === 0,
      blockingReasons
    };

    const globalWarningsSet = new Set<string>();
    evaluations.forEach(e => {
      e.warnings.forEach(w => globalWarningsSet.add(w));
    });

    return {
      evaluationVersion: "1.0.0",
      overallTestCaseQualityScore,
      totalTestCasesEvaluated,
      passingTestCasesCount,
      failingTestCasesCount,
      testCasesEvaluations: evaluations,
      testCaseGenerationReadiness,
      globalWarnings: Array.from(globalWarningsSet)
    };
  }
}
