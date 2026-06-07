import { z } from 'zod';
import { AiReadyContextSchema } from './context.schema';
import { RepositoryUnderstandingSchema, QualityScorecardSchema } from './understanding.schema';

export const FeatureRiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const FeatureTypeSchema = z.enum(["CORE", "SUPPORTING", "ADMINISTRATIVE", "INTEGRATION"]);

export const FeatureSchema = z.object({
  featureName: z.string()
    .min(1, "Feature name is required")
    .max(100, "Feature name is too long"),
  featureType: FeatureTypeSchema,
  description: z.string()
    .min(10, "Feature description must be descriptive")
    .max(1000, "Feature description is too long"),
  confidenceScore: z.number()
    .min(0, "Confidence score cannot be negative")
    .max(1, "Confidence score cannot exceed 1.0"),
  evidence: z.array(z.string())
    .min(1, "Feature must be backed by at least one valid codebase path or endpoint"),
  sourceWorkflows: z.array(z.string())
    .min(1, "Feature must map to at least one source workflow defined in repository understanding"),
  riskLevel: z.string().min(1, "Risk level is required")
});

export const FeatureDiscoveryOutputSchema = z.object({
  features: z.array(FeatureSchema)
});

export const DiscoveryReadinessSchema = z.object({
  ready: z.boolean(),
  blockingReasons: z.array(z.string())
});

export const EvidenceSummarySchema = z.object({
  totalEvidenceFiles: z.number(),
  mappedEvidenceFiles: z.number(),
  unmappedEvidenceFiles: z.number()
});

export const DiscoveryCandidatesSchema = z.object({
  routes: z.array(z.string()),
  apis: z.array(z.string()),
  forms: z.array(z.string()),
  components: z.array(z.string())
});

export const DiscoveryContextSchema = z.object({
  contextVersion: z.literal("1.0.0"),
  builderMetadata: z.object({
    generatedAt: z.string(),
    qualityThresholdUsed: z.number()
  }),
  applicationSummary: z.object({
    purpose: z.string(),
    targetUsers: z.array(z.string()),
    businessDomains: z.array(z.string())
  }),
  aggregatedWorkflows: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      routes: z.array(z.string()),
      apis: z.array(z.string()),
      evidence: z.array(z.string())
    })
  ),
  riskProfile: z.array(
    z.object({
      name: z.string(),
      riskFactor: z.string(),
      mitigationFocus: z.string()
    })
  ),
  discoveryReadiness: DiscoveryReadinessSchema,
  evidenceSummary: EvidenceSummarySchema,
  discoveryCandidates: DiscoveryCandidatesSchema,
  qualityGate: z.object({
    qualityScore: z.number(),
    isQualityPassing: z.boolean(),
    warnings: z.array(z.string())
  })
});

/**
 * Performs run-time validation on the feature discovery output.
 */
export function validateFeatureDiscoveryOutput(payload: unknown): z.infer<typeof FeatureDiscoveryOutputSchema> {
  return FeatureDiscoveryOutputSchema.parse(payload);
}

/**
 * Performs run-time validation on the discovery context.
 */
export function validateDiscoveryContext(payload: unknown): z.infer<typeof DiscoveryContextSchema> {
  return DiscoveryContextSchema.parse(payload);
}
