import { 
  AnalysisRun, 
  DashboardViewModel, 
  CoverageViewModel, 
  ExecutionViewModel, 
  ComparisonViewModel 
} from '../types';

/**
 * Validates that a contract version is compatible with the expected version.
 * Accepts exact match or patch-level increments within the same minor version.
 * e.g., expected '1.0.0' accepts '1.0.0', '1.0.1', '1.0.99' but NOT '1.1.0' or '2.0.0'.
 */
export function isCompatibleVersion(actual: string | undefined, expected: string = '1.0.0'): boolean {
  if (!actual) return true; // Allow missing version (assume compatible)
  
  const parseVersion = (v: string): [number, number, number] | null => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  };

  const actualParts = parseVersion(actual);
  const expectedParts = parseVersion(expected);

  if (!actualParts || !expectedParts) return true; // Gracefully accept unparseable versions

  // Major and minor must match exactly; patch can vary
  return actualParts[0] === expectedParts[0] && actualParts[1] === expectedParts[1];
}

/** Safely extract a numeric value with a fallback default */
function safeNum(value: any, fallback: number = 0): number {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  return typeof value === 'number' ? value : parseFloat(value) || fallback;
}

export function mapToDashboardViewModel(run: AnalysisRun): DashboardViewModel {
  const coverage = run.coverageDashboardPayload || {};
  const scorecard = run.executionScorecard || {};
  
  const stats = run.repositoryStatistics || {};
  const discovery = run.coverageDiscoveryContext || {};
  const metadata = scorecard.builderMetadata || {};

  const contractVersion = run.executionScorecard?.contractVersion || run.coverageDashboardPayload?.contractVersion;
  const versionCompatible = isCompatibleVersion(contractVersion, '1.0.0');

  // Extract base counts (prefer discoveryContext over repositoryStatistics)
  const featureCount = safeNum(discovery.featuresCount) || safeNum(stats.totalFeatures);
  const scenarioCount = safeNum(discovery.scenariosCount) || safeNum(stats.totalScenarios);
  const testCaseCount = safeNum(discovery.testCasesCount) || safeNum(stats.totalTestCases);
  const automatedCount = safeNum(discovery.automationScriptsCount) || safeNum(stats.totalAutomated);

  // Extract percentage metrics
  const automationCoverage = safeNum(coverage.automationCoverage);
  const coverageConfidence = safeNum(coverage.coverageConfidenceScore);
  
  const executionConfidence = safeNum(scorecard.executionConfidenceScore);
  const passRate = safeNum(scorecard.passRate);
  const flakyRate = safeNum(metadata.flakyRate);

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
    blockingReasons,
    contractVersion: contractVersion || '1.0.0',
    versionCompatible
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
        featureType: f.featureType || 'CORE',
        description: f.description || '',
        scenariosCount: f.scenariosCount || 0,
        testCasesCount: f.testCasesCount || 0,
        automatedCount: f.automatedCount || 0,
        coverageRatio: f.coverageRatio || 0,
        confidenceScore: f.confidenceScore || 0,
        qualityWarnings: f.qualityWarnings || [],
        scenarios: (f.scenarios || []).map((s: any) => ({
          id: s.id || '',
          scenarioName: s.scenarioName || '',
          scenarioType: s.scenarioType || 'POSITIVE',
          description: s.description || '',
          confidenceScore: s.confidenceScore || 0,
          riskLevel: s.riskLevel || 'MEDIUM',
          priority: s.priority || 'MEDIUM',
          testCases: (s.testCases || []).map((tc: any) => ({
            id: tc.id || '',
            testCaseKey: tc.testCaseKey || '',
            testCaseName: tc.testCaseName || '',
            testCaseType: tc.testCaseType || 'FUNCTIONAL',
            priority: tc.priority || 'MEDIUM',
            description: tc.description || '',
            preconditions: tc.preconditions || [],
            steps: tc.steps || [],
            expectedResult: tc.expectedResult || '',
            riskLevel: tc.riskLevel || 'MEDIUM',
            automationStatus: tc.automationStatus || 'UNAUTOMATED',
            automationPath: tc.automationPath || null
          }))
        }))
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
