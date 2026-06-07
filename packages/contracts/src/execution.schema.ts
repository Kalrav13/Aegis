import { z } from 'zod';

export const ExecutionSourceSchema = z.enum([
  'LOCAL',
  'GITHUB_ACTIONS',
  'JENKINS',
  'GITLAB_CI',
  'AZURE_DEVOPS',
  'MANUAL_IMPORT'
]);

export const FailureSeveritySchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW'
]);

export const TrendDirectionSchema = z.enum([
  'IMPROVING',
  'DECLINING',
  'STABLE'
]);

export const ExecutionStatusSchema = z.enum([
  'PASSED',
  'FAILED',
  'SKIPPED',
  'BLOCKED',
  'TIMED_OUT'
]);

export const FailureCategorySchema = z.enum([
  'ASSERTION',
  'TIMEOUT',
  'NETWORK',
  'SELECTOR',
  'UNKNOWN'
]);

export const ArtifactTypeSchema = z.enum([
  'SCREENSHOT',
  'VIDEO',
  'TRACE',
  'LOG'
]);

export const ExecutionResultSchema = z.object({
  id: z.string().uuid("Invalid execution result UUID"),
  executionRunId: z.string().uuid("Invalid execution run UUID"),
  automationScriptId: z.string().uuid("Invalid automation script UUID").nullable().optional(),
  status: ExecutionStatusSchema,
  failureCategory: FailureCategorySchema.optional(),
  failureSeverity: FailureSeveritySchema.optional(),
  durationMs: z.number().int().nonnegative(),
  failureReason: z.string().optional(),
  retryCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime()
});

export const ExecutionArtifactSchema = z.object({
  id: z.string().uuid("Invalid execution artifact UUID"),
  executionResultId: z.string().uuid("Invalid execution result UUID"),
  artifactType: ArtifactTypeSchema,
  path: z.string(),
  sizeBytes: z.number().int().nonnegative().optional(),
  createdAt: z.string().datetime(),
  checksum: z.string().optional(),
  expiresAt: z.string().datetime().optional()
});

export const ExecutionRunSchema = z.object({
  id: z.string().uuid("Invalid execution run UUID"),
  analysisRunId: z.string().uuid("Invalid analysis run UUID"),
  executionEnvironment: z.string(),
  browser: z.string(),
  operatingSystem: z.string(),
  frameworkVersion: z.string(),
  executionSource: ExecutionSourceSchema,
  externalExecutionId: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  totalTests: z.number().int().nonnegative(),
  passedTests: z.number().int().nonnegative(),
  failedTests: z.number().int().nonnegative(),
  skippedTests: z.number().int().nonnegative(),
  blockedTests: z.number().int().nonnegative(),
  timedOutTests: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative()
});

export const ExecutionReadinessSchema = z.object({
  ready: z.boolean(),
  blockingReasons: z.array(z.string())
});

export const ExecutionScorecardSchema = z.object({
  version: z.literal("1.0.0", {
    required_error: "Scorecard version is required",
    invalid_type_error: "Scorecard version must be '1.0.0'"
  }),
  passRate: z.number().min(0).max(100),
  failRate: z.number().min(0).max(100),
  skippedRate: z.number().min(0).max(100),
  blockedRate: z.number().min(0).max(100),
  timeoutRate: z.number().min(0).max(100),
  executionConfidenceScore: z.number().min(0).max(100),
  executionReadiness: ExecutionReadinessSchema,
  builderMetadata: z.object({
    generatedAt: z.string().datetime(),
    analysisRunId: z.string().uuid(),
    executionSuccessRate: z.number().min(0).max(100).optional(),
    retryRate: z.number().min(0).max(100).optional(),
    flakyRate: z.number().min(0).max(100).optional(),
    artifactAvailability: z.number().min(0).max(100).optional(),
    trendDirection: TrendDirectionSchema.optional(),
    sourceAnalytics: z.array(z.any()).optional()
  })
});

export const ExecutionQualitySchema = z.object({
  id: z.string().uuid("Invalid quality UUID"),
  executionRunId: z.string().uuid("Invalid execution run UUID"),
  passRateScore: z.number().min(0).max(100),
  flakyScore: z.number().min(0).max(100),
  retryStabilityScore: z.number().min(0).max(100),
  durationReliabilityScore: z.number().min(0).max(100),
  artifactCompletenessScore: z.number().min(0).max(100)
});

export const ExecutionExecutiveSummarySchema = z.object({
  overallExecutionScore: z.number().min(0).max(100),
  executionConfidenceScore: z.number().min(0).max(100),
  executionClassification: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']),
  releaseReady: z.boolean(),
  topStrengths: z.array(z.string()),
  topRisks: z.array(z.string()),
  recommendation: z.string(),
  recommendationSeverity: z.enum(['INFO', 'WARNING', 'CRITICAL'])
});

export const FailureIntelligenceReportItemSchema = z.object({
  resultId: z.string().uuid(),
  testCaseId: z.string().uuid().nullable().optional(),
  testCaseName: z.string(),
  failureReason: z.string(),
  durationMs: z.number().int().nonnegative(),
  failureCategory: FailureCategorySchema,
  ciDeepLink: z.string()
});

export const FailureIntelligenceReportSchema = z.object({
  criticalFailures: z.array(FailureIntelligenceReportItemSchema),
  highFailures: z.array(FailureIntelligenceReportItemSchema),
  mediumFailures: z.array(FailureIntelligenceReportItemSchema),
  lowFailures: z.array(FailureIntelligenceReportItemSchema)
});

export const FlakyIntelligenceReportItemSchema = z.object({
  testCaseId: z.string().uuid().nullable().optional(),
  testCaseName: z.string(),
  flakyRate: z.number().min(0).max(100),
  maintenancePriorityScore: z.number().nonnegative(),
  flakySeverity: z.enum(['HIGH', 'MEDIUM', 'LOW'])
});

export const FlakyIntelligenceReportSchema = z.object({
  highFlakyTests: z.array(FlakyIntelligenceReportItemSchema),
  mediumFlakyTests: z.array(FlakyIntelligenceReportItemSchema),
  lowFlakyTests: z.array(FlakyIntelligenceReportItemSchema),
  flakyRate: z.number().min(0).max(100),
  stabilityIndex: z.number().min(0).max(100)
});

export const ExecutionTrendReportItemSchema = z.object({
  analysisRunId: z.string().uuid(),
  startedAt: z.string().datetime(),
  passRate: z.number().min(0).max(100),
  failRate: z.number().min(0).max(100),
  flakyRate: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  ready: z.boolean()
});

export const ExecutionTrendReportSchema = z.object({
  history: z.array(ExecutionTrendReportItemSchema),
  passRateTrend: TrendDirectionSchema,
  failRateTrend: TrendDirectionSchema,
  flakyRateTrend: TrendDirectionSchema,
  confidenceTrend: TrendDirectionSchema
});

export const ExecutionSourceAnalyticsItemSchema = z.object({
  executionSource: ExecutionSourceSchema,
  averagePassRate: z.number().min(0).max(100),
  flakyRate: z.number().min(0).max(100),
  averageDurationMs: z.number().nonnegative(),
  sampleCount: z.number().int().nonnegative()
});

export const ExecutionSourceReportSchema = z.object({
  sourceSegments: z.array(ExecutionSourceAnalyticsItemSchema)
});

export const ExecutionReportingQualitySchema = z.object({
  completenessScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100),
  trendIntegrityScore: z.number().min(0).max(100),
  reportingAccuracyScore: z.number().min(0).max(100)
});

export const ExecutionReportingReadinessSchema = z.object({
  ready: z.boolean(),
  blockingReasons: z.array(z.string())
});

export const ExecutionDashboardPayloadSchema = z.object({
  version: z.literal("1.0.0"),
  generatedAt: z.string().datetime(),
  analysisRunId: z.string().uuid(),
  executiveSummary: ExecutionExecutiveSummarySchema,
  readiness: ExecutionReadinessSchema,
  failuresReport: FailureIntelligenceReportSchema,
  flakyReport: FlakyIntelligenceReportSchema,
  trendsReport: ExecutionTrendReportSchema,
  sourceReport: ExecutionSourceReportSchema,
  qualityMetrics: ExecutionQualitySchema
});

export type ExecutionSource = z.infer<typeof ExecutionSourceSchema>;
export type FailureSeverity = z.infer<typeof FailureSeveritySchema>;
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type FailureCategory = z.infer<typeof FailureCategorySchema>;
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type ExecutionArtifact = z.infer<typeof ExecutionArtifactSchema>;
export type ExecutionRun = z.infer<typeof ExecutionRunSchema>;
export type ExecutionReadiness = z.infer<typeof ExecutionReadinessSchema>;
export type ExecutionScorecard = z.infer<typeof ExecutionScorecardSchema>;
export type ExecutionQuality = z.infer<typeof ExecutionQualitySchema>;

export type ExecutionExecutiveSummary = z.infer<typeof ExecutionExecutiveSummarySchema>;
export type FailureIntelligenceReportItem = z.infer<typeof FailureIntelligenceReportItemSchema>;
export type FailureIntelligenceReport = z.infer<typeof FailureIntelligenceReportSchema>;
export type FlakyIntelligenceReportItem = z.infer<typeof FlakyIntelligenceReportItemSchema>;
export type FlakyIntelligenceReport = z.infer<typeof FlakyIntelligenceReportSchema>;
export type ExecutionTrendReportItem = z.infer<typeof ExecutionTrendReportItemSchema>;
export type ExecutionTrendReport = z.infer<typeof ExecutionTrendReportSchema>;
export type ExecutionSourceAnalyticsItem = z.infer<typeof ExecutionSourceAnalyticsItemSchema>;
export type ExecutionSourceReport = z.infer<typeof ExecutionSourceReportSchema>;
export type ExecutionReportingQuality = z.infer<typeof ExecutionReportingQualitySchema>;
export type ExecutionReportingReadiness = z.infer<typeof ExecutionReportingReadinessSchema>;
export type ExecutionDashboardPayload = z.infer<typeof ExecutionDashboardPayloadSchema>;

export function validateExecutionRun(payload: unknown): ExecutionRun {
  return ExecutionRunSchema.parse(payload);
}

export function validateExecutionScorecard(payload: unknown): ExecutionScorecard {
  return ExecutionScorecardSchema.parse(payload);
}

export function validateExecutionResult(payload: unknown): ExecutionResult {
  return ExecutionResultSchema.parse(payload);
}

export function validateExecutionArtifact(payload: unknown): ExecutionArtifact {
  return ExecutionArtifactSchema.parse(payload);
}

export function validateExecutionQuality(payload: unknown): ExecutionQuality {
  return ExecutionQualitySchema.parse(payload);
}

export function validateExecutionDashboardPayload(payload: unknown): ExecutionDashboardPayload {
  return ExecutionDashboardPayloadSchema.parse(payload);
}

export function validateExecutionReportingQuality(payload: unknown): ExecutionReportingQuality {
  return ExecutionReportingQualitySchema.parse(payload);
}
