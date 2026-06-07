import { z } from 'zod';

export const FeatureQualityScoreSchema = z.object({
  featureId: z.string(),
  qualityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  evidenceCoverageScore: z.number().min(0).max(100),
  workflowCoverageScore: z.number().min(0).max(100),
  confidenceReliabilityScore: z.number().min(0).max(100),
  riskClassificationScore: z.number().min(0).max(100),
  warnings: z.array(z.string())
});

export const FeatureQualityScorecardSchema = z.object({
  overallQualityScore: z.number().min(0).max(100),
  totalFeaturesEvaluated: z.number(),
  passingFeaturesCount: z.number(), // features with qualityScore >= 70
  failingFeaturesCount: z.number(), // features with qualityScore < 70
  featuresEvaluations: z.array(FeatureQualityScoreSchema),
  globalWarnings: z.array(z.string())
});

export type FeatureQualityScore = z.infer<typeof FeatureQualityScoreSchema>;
export type FeatureQualityScorecard = z.infer<typeof FeatureQualityScorecardSchema>;

export function validateFeatureQualityScorecard(payload: unknown): FeatureQualityScorecard {
  return FeatureQualityScorecardSchema.parse(payload);
}
