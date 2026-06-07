import { z } from 'zod';
import { IntelligenceManifestSchema, InteractionRegistrySchema } from './manifest.schema';
import { RepositoryUnderstandingSchema, InferenceMetaDataSchema, QualityScorecardSchema } from './understanding.schema';
import { AiReadyContextSchema } from './context.schema';
import { FeatureSchema, FeatureDiscoveryOutputSchema, DiscoveryContextSchema } from './feature.schema';
import { FeatureQualityScoreSchema, FeatureQualityScorecardSchema } from './feature-quality.schema';
import { ScenarioTypeSchema, ScenarioSchema, ScenarioDiscoveryOutputSchema, ScenarioDiscoveryContextSchema } from './scenario.schema';
import { ScenarioQualityScoreSchema, ScenarioQualityScorecardSchema } from './scenario-quality.schema';
import {
  TestStepSchema,
  TestCaseTypeSchema,
  TestCaseSchema,
  TestCaseQualitySchema,
  TestCaseQualityScorecardSchema,
  TestCaseDiscoveryContextSchema,
  TestCaseDiscoveryOutputSchema
} from './test-case.schema';

import {
  AutomationFrameworkSchema,
  AutomationScriptSchema,
  AutomationDiscoveryContextSchema,
  AutomationGenerationOutputSchema,
  AutomationQualitySchema,
  AutomationQualityScorecardSchema
} from './automation.schema';

import {
  CoverageClassificationSchema,
  CoverageGapSummarySchema,
  CoverageReportSchema,
  CoverageDiscoveryContextSchema,
  CoverageScorecardSchema,
  ExecutiveSummarySchema,
  CoverageGapReportSchema,
  CoverageTrendReportSchema,
  ReportingQualitySchema,
  ReportingReadinessSchema,
  CoverageDashboardPayloadSchema
} from './coverage.schema';


export * from './manifest.schema';
export * from './understanding.schema';
export * from './context.schema';
export * from './feature.schema';
export * from './feature-quality.schema';
export * from './scenario.schema';
export * from './scenario-quality.schema';
export * from './test-case.schema';
export * from './automation.schema';
export * from './coverage.schema';
export * from './validation';



// TypeScript Types inferred from Zod Schemas
export type IntelligenceManifest = z.infer<typeof IntelligenceManifestSchema>;
export type InteractionRegistry = z.infer<typeof InteractionRegistrySchema>;
export type RepositoryUnderstanding = z.infer<typeof RepositoryUnderstandingSchema>;
export type InferenceMetaData = z.infer<typeof InferenceMetaDataSchema>;
export type AiReadyContext = z.infer<typeof AiReadyContextSchema>;
export type QualityScorecard = z.infer<typeof QualityScorecardSchema>;

export type Feature = z.infer<typeof FeatureSchema>;
export type FeatureDiscoveryOutput = z.infer<typeof FeatureDiscoveryOutputSchema>;
export type DiscoveryContext = z.infer<typeof DiscoveryContextSchema>;

export type FeatureQualityScore = z.infer<typeof FeatureQualityScoreSchema>;
export type FeatureQualityScorecard = z.infer<typeof FeatureQualityScorecardSchema>;

export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioDiscoveryOutput = z.infer<typeof ScenarioDiscoveryOutputSchema>;
export type ScenarioDiscoveryContext = z.infer<typeof ScenarioDiscoveryContextSchema>;

export type ScenarioQualityScore = z.infer<typeof ScenarioQualityScoreSchema>;
export type ScenarioQualityScorecard = z.infer<typeof ScenarioQualityScorecardSchema>;

export type TestStep = z.infer<typeof TestStepSchema>;
export type TestCaseType = z.infer<typeof TestCaseTypeSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestCaseQuality = z.infer<typeof TestCaseQualitySchema>;
export type TestCaseQualityScorecard = z.infer<typeof TestCaseQualityScorecardSchema>;
export type TestCaseDiscoveryContext = z.infer<typeof TestCaseDiscoveryContextSchema>;
export type TestCaseDiscoveryOutput = z.infer<typeof TestCaseDiscoveryOutputSchema>;

export type AutomationFramework = z.infer<typeof AutomationFrameworkSchema>;
export type AutomationScript = z.infer<typeof AutomationScriptSchema>;
export type AutomationDiscoveryContext = z.infer<typeof AutomationDiscoveryContextSchema>;
export type AutomationGenerationOutput = z.infer<typeof AutomationGenerationOutputSchema>;
export type AutomationQuality = z.infer<typeof AutomationQualitySchema>;
export type AutomationQualityScorecard = z.infer<typeof AutomationQualityScorecardSchema>;

export type CoverageClassification = z.infer<typeof CoverageClassificationSchema>;
export type CoverageGapSummary = z.infer<typeof CoverageGapSummarySchema>;
export type CoverageReport = z.infer<typeof CoverageReportSchema>;
export type CoverageDiscoveryContext = z.infer<typeof CoverageDiscoveryContextSchema>;
export type CoverageScorecard = z.infer<typeof CoverageScorecardSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
export type CoverageGapReport = z.infer<typeof CoverageGapReportSchema>;
export type CoverageTrendReport = z.infer<typeof CoverageTrendReportSchema>;
export type ReportingQuality = z.infer<typeof ReportingQualitySchema>;
export type ReportingReadiness = z.infer<typeof ReportingReadinessSchema>;
export type CoverageDashboardPayload = z.infer<typeof CoverageDashboardPayloadSchema>;


