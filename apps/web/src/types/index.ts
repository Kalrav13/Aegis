export interface Project {
  id: string;
  name: string;
  gitUrl: string;
  defaultBranch: string;
  createdAt: string;
}

export interface AnalysisRun {
  id: string;
  projectId: string;
  status: 'IDLE' | 'CLONING' | 'FILTERING' | 'ANALYZING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  commitSha: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  repositoryStatistics?: any;
  interactionRegistry?: any;
  repositoryUnderstanding?: any;
  aiReadyContext?: any;
  qualityScorecard?: any;
  discoveryContext?: any;
  featureQualityScorecard?: any;
  scenarioDiscoveryContext?: any;
  scenarioQualityScorecard?: any;
  testCaseDiscoveryContext?: any;
  testCaseQualityScorecard?: any;
  automationDiscoveryContext?: any;
  automationQualityScorecard?: any;
  coverageDiscoveryContext?: any;
  coverageQualityScorecard?: any;
  coverageDashboardPayload?: any;
  executionDiscoveryContext?: any;
  executionScorecard?: any;
  executionDashboardPayload?: any;
  executionReportingQuality?: any;
}

export interface DashboardViewModel {
  analysisId: string;
  status: string;
  startedAt: string;
  commitSha: string;
  // Consolidated counts
  featureCount: number;
  scenarioCount: number;
  testCaseCount: number;
  automatedCount: number;
  // Consolidated percentages
  automationCoverage: number;
  coverageConfidence: number;
  executionConfidence: number;
  passRate: number;
  flakyRate: number;
  // Readiness Gates
  ready: boolean;
  blockingReasons: string[];
}

export interface CoverageViewModel {
  reportId: string;
  featureCoverage: number;
  scenarioCoverage: number;
  testCaseCoverage: number;
  automationCoverage: number;
  coverageConfidenceScore: number;
  coverageClassification: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  coverageGapSummary: string[];
  details: {
    features: Array<{
      featureId: string;
      featureName: string;
      scenariosCount: number;
      testCasesCount: number;
      automatedCount: number;
      coverageRatio: number;
      confidenceScore: number;
    }>;
    traceabilityGaps: Array<{
      type: 'FEATURE' | 'SCENARIO' | 'TEST_CASE';
      name: string;
      reason: string;
    }>;
  };
}

export interface FailureItemViewModel {
  resultId: string;
  testCaseName: string;
  failureReason: string;
  durationMs: number;
  failureCategory: string;
  ciDeepLink: string;
}

export interface FlakyItemViewModel {
  testCaseId: string | null;
  testCaseName: string;
  flakyRate: number;
  maintenancePriorityScore: number;
  flakySeverity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TrendItemViewModel {
  analysisRunId: string;
  startedAt: string;
  passRate: number;
  failRate: number;
  flakyRate: number;
  confidenceScore: number;
  ready: boolean;
}

export interface SourceSegmentViewModel {
  executionSource: string;
  averagePassRate: number;
  flakyRate: number;
  averageDurationMs: number;
  sampleCount: number;
}

export interface ExecutionViewModel {
  analysisId: string;
  generatedAt: string;
  overallScore: number;
  confidenceScore: number;
  classification: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  releaseReady: boolean;
  recommendation: string;
  recommendationSeverity: 'INFO' | 'WARNING' | 'CRITICAL';
  topStrengths: string[];
  topRisks: string[];
  // Failure grouping
  failures: {
    critical: FailureItemViewModel[];
    high: FailureItemViewModel[];
    medium: FailureItemViewModel[];
    low: FailureItemViewModel[];
  };
  // Flaky grouping
  flaky: {
    high: FlakyItemViewModel[];
    medium: FlakyItemViewModel[];
    low: FlakyItemViewModel[];
    flakyRate: number;
    stabilityIndex: number;
  };
  // Trend list
  trends: {
    history: TrendItemViewModel[];
    passRateTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    failRateTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    flakyRateTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
    confidenceTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  };
  // Segmented metrics
  sources: SourceSegmentViewModel[];
  // Metrics quality scores
  quality: {
    passRateScore: number;
    flakyScore: number;
    retryStabilityScore: number;
    durationReliabilityScore: number;
    artifactCompletenessScore: number;
  };
}

export interface ComparisonViewModel {
  runAId: string;
  runBId: string;
  // Comparison Deltas (Run B - Run A)
  passRateDelta: number;
  flakyRateDelta: number;
  confidenceDelta: number;
  coverageDelta: number;
  // Entity Deltas
  featuresCountDelta: number;
  scenariosCountDelta: number;
  testCasesCountDelta: number;
  automatedCountDelta: number;
}
