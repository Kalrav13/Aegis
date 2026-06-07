import { z } from 'zod';

export const CoverageClassificationSchema = z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]);

export const CoverageGapSummarySchema = z.object({
  uncoveredFeaturesCount: z.number().int().nonnegative(),
  uncoveredScenariosCount: z.number().int().nonnegative(),
  uncoveredTestCasesCount: z.number().int().nonnegative(),
  unautomatedTestCasesCount: z.number().int().nonnegative()
});

export const CoverageReportSchema = z.object({
  reportId: z.string().uuid("Invalid report UUID"),
  analysisRunId: z.string().uuid("Invalid analysis run UUID"),
  featureCoverage: z.number().min(0).max(100),
  scenarioCoverage: z.number().min(0).max(100),
  testCaseCoverage: z.number().min(0).max(100),
  automationCoverage: z.number().min(0).max(100),
  executionReadinessScore: z.number().min(0).max(100),
  coverageConfidenceScore: z.number().min(0).max(100),
  coverageClassification: CoverageClassificationSchema,
  coverageGapSummary: CoverageGapSummarySchema,
  details: z.object({
    uncoveredFeatureIds: z.array(z.string()),
    uncoveredScenarioIds: z.array(z.string()),
    unautomatedTestCaseIds: z.array(z.string()),
    criticalCoverageGaps: z.array(z.string())
  })
});

export const CoverageDiscoveryContextSchema = z.object({
  contextVersion: z.literal("1.0.0", {
    required_error: "Context version is required",
    invalid_type_error: "Context version must be '1.0.0'"
  }),
  featuresCount: z.number().int().nonnegative(),
  scenariosCount: z.number().int().nonnegative(),
  testCasesCount: z.number().int().nonnegative(),
  automationScriptsCount: z.number().int().nonnegative(),
  upstreamReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  })
});

export const CoverageScorecardSchema = z.object({
  scorecardVersion: z.literal("1.0.0", {
    required_error: "Scorecard version is required",
    invalid_type_error: "Scorecard version must be '1.0.0'"
  }),
  builderMetadata: z.object({
    generatedAt: z.string(),
    analysisRunId: z.string().uuid()
  }),
  featureCoverage: z.number().min(0).max(100),
  scenarioCoverage: z.number().min(0).max(100),
  testCaseCoverage: z.number().min(0).max(100),
  automationCoverage: z.number().min(0).max(100),
  executionReadinessScore: z.number().min(0).max(100),
  coverageConfidenceScore: z.number().min(0).max(100),
  coverageClassification: CoverageClassificationSchema,
  coverageIntelligenceReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  })
});

export type CoverageClassification = z.infer<typeof CoverageClassificationSchema>;
export type CoverageGapSummary = z.infer<typeof CoverageGapSummarySchema>;
export type CoverageReport = z.infer<typeof CoverageReportSchema>;
export type CoverageDiscoveryContext = z.infer<typeof CoverageDiscoveryContextSchema>;
export type CoverageScorecard = z.infer<typeof CoverageScorecardSchema>;

export const ExecutiveSummarySchema = z.object({
  overallCoverageScore: z.number().min(0).max(100),
  coverageClassification: CoverageClassificationSchema,
  coverageConfidenceScore: z.number().min(0).max(100),
  topStrengths: z.array(z.string()),
  topRisks: z.array(z.string()),
  recommendation: z.string(),
  recommendationSeverity: z.enum(["INFO", "WARNING", "CRITICAL"])
});

export const CoverageGapReportSchema = z.object({
  criticalGaps: z.array(z.string()),
  highPriorityGaps: z.array(z.string()),
  mediumPriorityGaps: z.array(z.string()),
  lowPriorityGaps: z.array(z.string())
});

export const CoverageTrendReportSchema = z.object({
  trendDirection: z.object({
    coverageTrend: z.enum(["IMPROVING", "DECLINING", "STABLE"]),
    automationTrend: z.enum(["IMPROVING", "DECLINING", "STABLE"]),
    confidenceTrend: z.enum(["IMPROVING", "DECLINING", "STABLE"])
  }),
  history: z.array(z.object({
    analysisRunId: z.string().uuid(),
    generatedAt: z.string(),
    featureCoverage: z.number().min(0).max(100),
    scenarioCoverage: z.number().min(0).max(100),
    testCaseCoverage: z.number().min(0).max(100),
    automationCoverage: z.number().min(0).max(100),
    coverageConfidenceScore: z.number().min(0).max(100)
  }))
});

export const ReportingQualitySchema = z.object({
  completenessScore: z.number().min(0).max(100),
  consistencyScore: z.number().min(0).max(100),
  trendIntegrityScore: z.number().min(0).max(100),
  reportingAccuracyScore: z.number().min(0).max(100)
});

export const ReportingReadinessSchema = z.object({
  ready: z.boolean(),
  blockingReasons: z.array(z.string())
});

export const CoverageDashboardPayloadSchema = z.object({
  payloadVersion: z.literal("1.0.0", {
    required_error: "Payload version is required",
    invalid_type_error: "Payload version must be '1.0.0'"
  }),
  executiveSummary: ExecutiveSummarySchema,
  coverageOverview: z.object({
    featureCoverage: z.number().min(0).max(100),
    scenarioCoverage: z.number().min(0).max(100),
    testCaseCoverage: z.number().min(0).max(100),
    automationCoverage: z.number().min(0).max(100),
    executionReadinessScore: z.number().min(0).max(100),
    coverageConfidenceScore: z.number().min(0).max(100)
  }),
  gapReport: CoverageGapReportSchema,
  trendReport: CoverageTrendReportSchema,
  reportingQuality: ReportingQualitySchema,
  reportingReadiness: ReportingReadinessSchema
});

export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type CoverageGapReport = z.infer<typeof CoverageGapReportSchema>;
export type CoverageTrendReport = z.infer<typeof CoverageTrendReportSchema>;
export type ReportingQuality = z.infer<typeof ReportingQualitySchema>;
export type ReportingReadiness = z.infer<typeof ReportingReadinessSchema>;
export type CoverageDashboardPayload = z.infer<typeof CoverageDashboardPayloadSchema>;

export function validateCoverageReport(payload: unknown): CoverageReport {
  return CoverageReportSchema.parse(payload);
}

export function validateCoverageDiscoveryContext(payload: unknown): CoverageDiscoveryContext {
  return CoverageDiscoveryContextSchema.parse(payload);
}

export function validateCoverageScorecard(payload: unknown): CoverageScorecard {
  return CoverageScorecardSchema.parse(payload);
}

export function validateCoverageDashboardPayload(payload: unknown): CoverageDashboardPayload {
  return CoverageDashboardPayloadSchema.parse(payload);
}
