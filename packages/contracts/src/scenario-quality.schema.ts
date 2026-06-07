import { z } from 'zod';

export const ScenarioQualityScoreSchema = z.object({
  scenarioId: z.string().min(1, "Scenario ID is required"),
  qualityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  evidenceCoverageScore: z.number().min(0).max(100),
  workflowCoverageScore: z.number().min(0).max(100),
  priorityValidityScore: z.number().min(0).max(100),
  riskClassificationScore: z.number().min(0).max(100),
  traceabilityQualityScore: z.number().min(0).max(100),
  coverageTargetScore: z.number().min(0).max(100),
  confidenceReliabilityScore: z.number().min(0).max(100),
  warnings: z.array(z.string())
});

export const ScenarioQualityScorecardSchema = z.object({
  evaluationVersion: z.literal("1.0.0", {
    required_error: "Evaluation version is required",
    invalid_type_error: "Evaluation version must be '1.0.0'"
  }),
  overallScenarioQualityScore: z.number().min(0).max(100),
  totalScenariosEvaluated: z.number(),
  passingScenariosCount: z.number(),
  failingScenariosCount: z.number(),
  scenariosEvaluations: z.array(ScenarioQualityScoreSchema),
  scenarioGenerationReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  }),
  globalWarnings: z.array(z.string())
});

export type ScenarioQualityScore = z.infer<typeof ScenarioQualityScoreSchema>;
export type ScenarioQualityScorecard = z.infer<typeof ScenarioQualityScorecardSchema>;
