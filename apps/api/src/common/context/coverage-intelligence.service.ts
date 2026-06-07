import { Injectable } from '@nestjs/common';
import { prisma } from '@testlens/db';
import {
  CoverageReport,
  CoverageScorecard,
  CoverageDiscoveryContext,
  validateCoverageReport,
  validateCoverageScorecard,
  validateCoverageDiscoveryContext
} from '@testlens/contracts';
import { CoverageQuality } from '@testlens/db';
import { randomUUID } from 'crypto';

@Injectable()
export class CoverageIntelligenceService {
  /**
   * Evaluates coverage for an analysis run.
   */
  public async evaluateCoverage(
    analysisRunId: string,
    features: any[] = [],
    scenarios: any[] = [],
    testCases: any[] = [],
    automationScripts: any[] = [],
    automationQualityEvaluations: any[] = [],
    testCaseQualityEvaluations: any[] = [],
    upstreamReadiness: { ready: boolean; blockingReasons: string[] } = { ready: true, blockingReasons: [] }
  ): Promise<{
    report: CoverageReport;
    scorecard: CoverageScorecard;
    quality: CoverageQuality;
    context: CoverageDiscoveryContext;
  }> {
    const run = await prisma.analysisRun.findUnique({
      where: { id: analysisRunId }
    });
    if (!run) {
      throw new Error(`Analysis run with ID ${analysisRunId} not found`);
    }

    const reportId = run.id;
    const generatedAt = new Date().toISOString();

    const totalFeatures = features.length;
    const totalScenarios = scenarios.length;
    const totalTestCases = testCases.length;
    const totalAutomationScripts = automationScripts.length;

    const upstreamReady = upstreamReadiness.ready;
    const upstreamBlockingReasons = upstreamReadiness.blockingReasons;

    // Helper for safe division and 2 decimal place rounding
    const getPercentage = (numerator: number, denominator: number): number => {
      if (denominator === 0) return 0;
      const val = (numerator / denominator) * 100;
      return Math.round(val * 100) / 100;
    };

    // 1. Coverage Calculation Engine
    // Features with >= 1 Scenario
    const featuresWithScenarios = features.filter(f =>
      scenarios.some(s => s.scenarioOrigin?.featureIds?.includes(f.id))
    ).length;
    const featureCoverage = getPercentage(featuresWithScenarios, totalFeatures);

    // Scenarios with >= 1 Test Case
    const scenariosWithTestCases = scenarios.filter(s =>
      testCases.some(tc => tc.testCaseOrigin?.scenarioIds?.includes(s.scenarioId || s.id))
    ).length;
    const scenarioCoverage = getPercentage(scenariosWithTestCases, totalScenarios);

    // Test Cases linked to >= 1 Scenario
    const testCasesWithScenarios = testCases.filter(tc =>
      Array.isArray(tc.testCaseOrigin?.scenarioIds) && tc.testCaseOrigin.scenarioIds.length > 0
    ).length;
    const testCaseCoverage = getPercentage(testCasesWithScenarios, totalTestCases);

    // Automation Coverage
    const automatedTestCases = testCases.filter(tc => tc.automationStatus === 'AUTOMATED').length;
    const automationCoverage = getPercentage(automatedTestCases, totalTestCases);

    // E2E Traceability Coverage: Features traced to at least one automated test case
    const automatedTestCaseScenarioIds = new Set(
      testCases
        .filter(tc => tc.automationStatus === 'AUTOMATED')
        .flatMap(tc => tc.testCaseOrigin?.scenarioIds || [])
    );
    const tracedFeatureIds = new Set(
      scenarios
        .filter(s => automatedTestCaseScenarioIds.has(s.scenarioId || s.id))
        .flatMap(s => s.scenarioOrigin?.featureIds || [])
    );
    const tracedFeaturesCount = features.filter(f => tracedFeatureIds.has(f.id)).length;
    const e2eTraceabilityCoverage = getPercentage(tracedFeaturesCount, totalFeatures);

    // Execution Readiness Score: Automation scripts with quality score >= 70
    const passingScripts = automationQualityEvaluations.filter(e => e.qualityScore >= 70).length;
    const executionReadinessScore = getPercentage(passingScripts, totalAutomationScripts);

    // 2. Coverage Gap Engine
    const uncoveredFeatureIds = features
      .filter(f => !scenarios.some(s => s.scenarioOrigin?.featureIds?.includes(f.id)))
      .map(f => f.id);

    const uncoveredScenarioIds = scenarios
      .filter(s => !testCases.some(tc => tc.testCaseOrigin?.scenarioIds?.includes(s.scenarioId || s.id)))
      .map(s => s.scenarioId || s.id);

    const unautomatedTestCaseIds = testCases
      .filter(tc => tc.automationStatus !== 'AUTOMATED')
      .map(tc => tc.testCaseId || tc.id);

    const untestedTestCaseIds = testCases
      .filter(tc => !Array.isArray(tc.testCaseOrigin?.scenarioIds) || tc.testCaseOrigin.scenarioIds.length === 0)
      .map(tc => tc.testCaseId || tc.id);

    // Critical Gap Detection
    const criticalCoverageGaps: string[] = [];
    const isCriticalFlow = (text: string): boolean => {
      if (!text) return false;
      const keywords = ['auth', 'login', 'sign-in', 'register', 'checkout', 'payment', 'billing', 'delete', 'security', 'permission', 'authorize'];
      const normalized = text.toLowerCase();
      return keywords.some(k => normalized.includes(k));
    };

    features.forEach(f => {
      if (uncoveredFeatureIds.includes(f.id)) {
        const isHighRisk = f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL';
        const isCrit = isCriticalFlow(f.featureName) || isCriticalFlow(f.description);
        if (isHighRisk || isCrit) {
          criticalCoverageGaps.push(`[CRITICAL_GAP] Uncovered Feature '${f.featureName}' (Risk: ${f.riskLevel || 'MEDIUM'})`);
        }
      }
    });

    scenarios.forEach(s => {
      const sId = s.scenarioId || s.id;
      if (uncoveredScenarioIds.includes(sId)) {
        const isHighRisk = s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL';
        const isCrit = isCriticalFlow(s.scenarioName) || isCriticalFlow(s.description);
        if (isHighRisk || isCrit) {
          criticalCoverageGaps.push(`[CRITICAL_GAP] Uncovered Scenario '${s.scenarioName}' (Risk: ${s.riskLevel || 'MEDIUM'})`);
        }
      }
    });

    testCases.forEach(tc => {
      const tcId = tc.testCaseId || tc.id;
      if (unautomatedTestCaseIds.includes(tcId)) {
        const isHighRisk = tc.riskLevel === 'HIGH' || tc.riskLevel === 'CRITICAL';
        const isCrit = isCriticalFlow(tc.testCaseName) || isCriticalFlow(tc.description);
        if (isHighRisk || isCrit) {
          criticalCoverageGaps.push(`[CRITICAL_GAP] Unautomated Test Case '${tc.testCaseKey || tcId}: ${tc.testCaseName}' (Risk: ${tc.riskLevel || 'MEDIUM'})`);
        }
      }
    });

    // 3. Coverage Confidence Engine
    const traceabilityQuality = totalTestCases === 0 ? 0 : getPercentage(testCasesWithScenarios, totalTestCases);
    const coverageQuality = Math.round(((featureCoverage + scenarioCoverage + testCaseCoverage) / 3) * 100) / 100;
    const automationQuality = automationCoverage;
    const totalQualityScore = automationQualityEvaluations.reduce((sum, curr) => sum + (curr.qualityScore || 0), 0);
    const readinessQuality = totalAutomationScripts === 0 ? 0 : getPercentage(totalQualityScore, totalAutomationScripts) / 100 * 100;
    const reportingQuality = 100.00; // Complete details serialized

    let confidenceScore = (
      0.20 * traceabilityQuality +
      0.20 * coverageQuality +
      0.20 * automationQuality +
      0.20 * readinessQuality +
      0.20 * reportingQuality
    );
    confidenceScore = Math.round(confidenceScore * 100) / 100;

    // Minimum Sample Gate Refinement
    if (totalFeatures < 3 || totalScenarios < 5 || totalTestCases < 10) {
      if (confidenceScore > 80) {
        confidenceScore = 80;
      }
    }

    // 4. Classification Engine
    let classification: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'POOR';
    if (confidenceScore >= 90) {
      classification = 'EXCELLENT';
    } else if (confidenceScore >= 75) {
      classification = 'GOOD';
    } else if (confidenceScore >= 60) {
      classification = 'FAIR';
    } else {
      classification = 'POOR';
    }

    // 5. Coverage Readiness Engine
    const blockingReasons: string[] = [];

    if (!upstreamReady) {
      blockingReasons.push(...upstreamBlockingReasons);
      blockingReasons.push("Upstream readiness gate failed.");
    }

    if (totalFeatures === 0 || totalScenarios === 0 || totalTestCases === 0) {
      blockingReasons.push("Repository contains no discoverable coverage entities.");
    }

    if (totalAutomationScripts > 0 && automationQualityEvaluations.length === 0) {
      blockingReasons.push("Automation quality evaluations are unavailable.");
    }

    if (traceabilityQuality < 50) {
      blockingReasons.push(`Traceability quality score of ${traceabilityQuality.toFixed(2)}% is below the minimum threshold of 50%.`);
    }

    const isAnyNan = [featureCoverage, scenarioCoverage, testCaseCoverage, automationCoverage, e2eTraceabilityCoverage, confidenceScore].some(Number.isNaN);
    if (isAnyNan) {
      blockingReasons.push("Invalid score calculations detected (NaN).");
    }

    const ready = blockingReasons.length === 0;

    // Build finalized schemas for validation checks
    const reportPayload: CoverageReport = {
      reportId,
      analysisRunId,
      featureCoverage,
      scenarioCoverage,
      testCaseCoverage,
      automationCoverage,
      executionReadinessScore,
      coverageConfidenceScore: confidenceScore,
      coverageClassification: classification,
      coverageGapSummary: {
        uncoveredFeaturesCount: uncoveredFeatureIds.length,
        uncoveredScenariosCount: uncoveredScenarioIds.length,
        uncoveredTestCasesCount: untestedTestCaseIds.length,
        unautomatedTestCasesCount: unautomatedTestCaseIds.length
      },
      details: {
        uncoveredFeatureIds,
        uncoveredScenarioIds,
        unautomatedTestCaseIds,
        criticalCoverageGaps
      }
    };

    const report = validateCoverageReport(reportPayload);

    const contextPayload: CoverageDiscoveryContext = {
      contextVersion: '1.0.0',
      featuresCount: totalFeatures,
      scenariosCount: totalScenarios,
      testCasesCount: totalTestCases,
      automationScriptsCount: totalAutomationScripts,
      upstreamReadiness: {
        ready: upstreamReady,
        blockingReasons: upstreamBlockingReasons
      }
    };

    const context = validateCoverageDiscoveryContext(contextPayload);

    const scorecardPayload: CoverageScorecard = {
      scorecardVersion: '1.0.0',
      builderMetadata: {
        generatedAt,
        analysisRunId
      },
      featureCoverage,
      scenarioCoverage,
      testCaseCoverage,
      automationCoverage,
      executionReadinessScore,
      coverageConfidenceScore: confidenceScore,
      coverageClassification: classification,
      coverageIntelligenceReadiness: {
        ready,
        blockingReasons
      }
    };

    const scorecard = validateCoverageScorecard(scorecardPayload);

    // 6. CoverageQuality db record mapping
    const quality: CoverageQuality = {
      id: randomUUID(),
      reportId,
      traceabilityCompleteness: traceabilityQuality,
      coverageCompleteness: coverageQuality,
      automationCompleteness: automationQuality,
      readinessQuality: readinessQuality,
      reportingQuality: reportingQuality,
      createdAt: new Date()
    };

    return {
      report,
      scorecard,
      quality,
      context
    };
  }
}
