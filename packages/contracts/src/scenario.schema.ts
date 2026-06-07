import { z } from 'zod';

export const ScenarioTypeSchema = z.enum([
  "POSITIVE",
  "NEGATIVE",
  "EDGE_CASE",
  "SECURITY",
  "PERFORMANCE",
  "INTEGRATION"
]);

export const ScenarioSchema = z.object({
  scenarioId: z.string().min(1, "Scenario ID is required"),
  scenarioName: z.string()
    .min(1, "Scenario name is required")
    .max(100, "Scenario name is too long"),
  scenarioType: ScenarioTypeSchema,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string()
    .min(10, "Scenario description must be descriptive")
    .max(1000, "Scenario description is too long"),
  confidenceScore: z.number()
    .min(0, "Confidence score cannot be negative")
    .max(1, "Confidence score cannot exceed 1.0"),
  riskLevel: z.string().min(1, "Risk level is required"),
  parentFeatures: z.array(z.string())
    .min(1, "Scenario must map to at least one parent feature"),
  sourceWorkflows: z.array(z.string())
    .min(1, "Scenario must map to at least one source workflow"),
  evidence: z.array(z.string())
    .min(1, "Scenario must cite at least one grounding path or API endpoint"),
  coverageTargets: z.object({
    routes: z.array(z.string()),
    apis: z.array(z.string()),
    forms: z.array(z.string())
  }),
  scenarioOrigin: z.object({
    featureIds: z.array(z.string()),
    workflowIds: z.array(z.string())
  }).optional()
});

export const ScenarioDiscoveryOutputSchema = z.object({
  scenarios: z.array(ScenarioSchema)
});

export const ScenarioDiscoveryContextSchema = z.object({
  contextVersion: z.literal("1.0.0", {
    required_error: "Context version is required",
    invalid_type_error: "Context version must be '1.0.0'"
  }),
  builderMetadata: z.object({
    generatedAt: z.string(),
    featuresCount: z.number()
  }),
  applicationSummary: z.object({
    purpose: z.string(),
    targetUsers: z.array(z.string()),
    businessDomains: z.array(z.string())
  }),
  featureSummary: z.array(
    z.object({
      id: z.string(),
      featureName: z.string(),
      featureType: z.string(),
      description: z.string(),
      evidence: z.array(z.string()),
      sourceWorkflows: z.array(z.string()),
      riskLevel: z.string(),
      qualityScore: z.number().nullable(),
      warnings: z.array(z.string())
    })
  ).min(1, "Feature summary cannot be empty"),
  workflowSummary: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      steps: z.array(z.string()),
      routes: z.array(z.string()),
      apis: z.array(z.string()),
      evidence: z.array(z.string())
    })
  ),
  riskSummary: z.array(
    z.object({
      name: z.string(),
      riskFactor: z.string(),
      mitigationFocus: z.string()
    })
  ),
  evidenceSummary: z.object({
    totalEvidenceFiles: z.number(),
    mappedEvidenceFiles: z.number(),
    unmappedEvidenceFiles: z.number()
  }),
  candidateAssets: z.object({
    routes: z.array(z.string()),
    apis: z.array(z.string()),
    forms: z.array(z.string()),
    components: z.array(z.string())
  }),
  scenarioReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  }),
  coverageSummary: z.object({
    routeCoverageRatio: z.number().min(0, "Route coverage ratio cannot be negative").max(100, "Route coverage ratio cannot exceed 100"),
    apiCoverageRatio: z.number().min(0, "API coverage ratio cannot be negative").max(100, "API coverage ratio cannot exceed 100"),
    formCoverageRatio: z.number().min(0, "Form coverage ratio cannot be negative").max(100, "Form coverage ratio cannot exceed 100"),
    overallCoverageRatio: z.number().min(0, "Overall coverage ratio cannot be negative").max(100, "Overall coverage ratio cannot exceed 100"),
    warnings: z.array(z.string())
  })
});

export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioDiscoveryOutput = z.infer<typeof ScenarioDiscoveryOutputSchema>;
export type ScenarioDiscoveryContext = z.infer<typeof ScenarioDiscoveryContextSchema>;

export function validateScenarioDiscoveryOutput(payload: unknown): ScenarioDiscoveryOutput {
  return ScenarioDiscoveryOutputSchema.parse(payload);
}

export function validateScenarioDiscoveryContext(payload: unknown): ScenarioDiscoveryContext {
  return ScenarioDiscoveryContextSchema.parse(payload);
}
