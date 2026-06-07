import { 
  AnalysisRun, 
  DashboardViewModel, 
  CoverageViewModel, 
  ExecutionViewModel, 
  ComparisonViewModel 
} from '../types';

export function mapToDashboardViewModel(run: AnalysisRun): DashboardViewModel {
  const coverage = run.coverageDashboardPayload || {};
  const scorecard = run.executionScorecard || {};
  
  const stats = run.repositoryStatistics || {};
  const metadata = scorecard.builderMetadata || {};

  // Extract base counts
  const featureCount = stats.totalFeatures || 0;
  const scenarioCount = stats.totalScenarios || 0;
  const testCaseCount = stats.totalTestCases || 0;
  const automatedCount = stats.totalAutomated || 0;

  // Extract percentage metrics
  const automationCoverage = coverage.automationCoverage !== undefined ? coverage.automationCoverage : 0;
  const coverageConfidence = coverage.coverageConfidenceScore !== undefined ? coverage.coverageConfidenceScore : 0;
  
  const executionConfidence = scorecard.executionConfidenceScore !== undefined ? scorecard.executionConfidenceScore : 0;
  const passRate = scorecard.passRate !== undefined ? scorecard.passRate : 0;
  const flakyRate = metadata.flakyRate !== undefined ? metadata.flakyRate : 0;

  // Readiness gates
  const executionReadiness = scorecard.executionReadiness || {};
  const ready = executionReadiness.ready !== undefined ? executionReadiness.ready : false;
  const blockingReasons = executionReadiness.blockingReasons || [];

  return {
    analysisId: run.id,
    status: run.status,
    startedAt: run.startedAt,
    commitSha: run.commitSha || 'unknown',
    featureCount,
    scenarioCount,
    testCaseCount,
    automatedCount,
    automationCoverage,
    coverageConfidence,
    executionConfidence,
    passRate,
    flakyRate,
    ready,
    blockingReasons
  };
}

export function mapToCoverageViewModel(run: AnalysisRun): CoverageViewModel {
  const coverage = run.coverageDashboardPayload || {};
  const details = coverage.details || {};

  return {
    reportId: coverage.reportId || '',
    featureCoverage: coverage.featureCoverage || 0,
    scenarioCoverage: coverage.scenarioCoverage || 0,
    testCaseCoverage: coverage.testCaseCoverage || 0,
    automationCoverage: coverage.automationCoverage || 0,
    coverageConfidenceScore: coverage.coverageConfidenceScore || 0,
    coverageClassification: coverage.coverageClassification || 'POOR',
    coverageGapSummary: coverage.coverageGapSummary || [],
    details: {
      features: (details.features || []).map((f: any) => ({
        featureId: f.featureId || '',
        featureName: f.featureName || '',
        scenariosCount: f.scenariosCount || 0,
        testCasesCount: f.testCasesCount || 0,
        automatedCount: f.automatedCount || 0,
        coverageRatio: f.coverageRatio || 0,
        confidenceScore: f.confidenceScore || 0
      })),
      traceabilityGaps: (details.traceabilityGaps || []).map((g: any) => ({
        type: g.type || 'FEATURE',
        name: g.name || '',
        reason: g.reason || ''
      }))
    }
  };
}

export function mapToExecutionViewModel(run: AnalysisRun): ExecutionViewModel {
  const payload = run.executionDashboardPayload || {};
  const summary = payload.executiveSummary || {};
  const failures = payload.failuresReport || {};
  const flaky = payload.flakyReport || {};
  const trends = payload.trendsReport || {};
  const source = payload.sourceReport || {};
  const quality = payload.qualityMetrics || {};

  return {
    analysisId: run.id,
    generatedAt: payload.generatedAt || new Date().toISOString(),
    overallScore: summary.overallExecutionScore || 0,
    confidenceScore: summary.executionConfidenceScore || 0,
    classification: summary.executionClassification || 'POOR',
    releaseReady: summary.releaseReady !== undefined ? summary.releaseReady : false,
    recommendation: summary.recommendation || 'No executions performed.',
    recommendationSeverity: summary.recommendationSeverity || 'INFO',
    topStrengths: summary.topStrengths || [],
    topRisks: summary.topRisks || [],
    failures: {
      critical: failures.criticalFailures || [],
      high: failures.highFailures || [],
      medium: failures.mediumFailures || [],
      low: failures.lowFailures || []
    },
    flaky: {
      high: flaky.highFlakyTests || [],
      medium: flaky.mediumFlakyTests || [],
      low: flaky.lowFlakyTests || [],
      flakyRate: flaky.flakyRate || 0,
      stabilityIndex: flaky.stabilityIndex || 100
    },
    trends: {
      history: trends.history || [],
      passRateTrend: trends.passRateTrend || 'STABLE',
      failRateTrend: trends.failRateTrend || 'STABLE',
      flakyRateTrend: trends.flakyRateTrend || 'STABLE',
      confidenceTrend: trends.confidenceTrend || 'STABLE'
    },
    sources: source.sourceSegments || [],
    quality: {
      passRateScore: quality.passRateScore || 0,
      flakyScore: quality.flakyScore || 100,
      retryStabilityScore: quality.retryStabilityScore || 100,
      durationReliabilityScore: quality.durationReliabilityScore || 100,
      artifactCompletenessScore: quality.artifactCompletenessScore || 100
    }
  };
}

export function mapToComparisonViewModel(runA: AnalysisRun, runB: AnalysisRun): ComparisonViewModel {
  const vmA = mapToDashboardViewModel(runA);
  const vmB = mapToDashboardViewModel(runB);

  return {
    runAId: runA.id,
    runBId: runB.id,
    passRateDelta: Math.round((vmB.passRate - vmA.passRate) * 100) / 100,
    flakyRateDelta: Math.round((vmB.flakyRate - vmA.flakyRate) * 100) / 100,
    confidenceDelta: Math.round((vmB.executionConfidence - vmA.executionConfidence) * 100) / 100,
    coverageDelta: Math.round((vmB.automationCoverage - vmA.automationCoverage) * 100) / 100,
    featuresCountDelta: vmB.featureCount - vmA.featureCount,
    scenariosCountDelta: vmB.scenarioCount - vmA.scenarioCount,
    testCasesCountDelta: vmB.testCaseCount - vmA.testCaseCount,
    automatedCountDelta: vmB.automatedCount - vmA.automatedCount
  };
}
