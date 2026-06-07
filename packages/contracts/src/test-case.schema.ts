import { z } from 'zod';

export const TestStepSchema = z.object({
  stepNumber: z.number().int().positive("Step number must be a positive integer"),
  action: z.string().min(1, "Step action is required"),
  expectedResult: z.string().min(1, "Step expected result is required")
});

export const TestCaseTypeSchema = z.enum([
  "FUNCTIONAL",
  "NEGATIVE",
  "EDGE_CASE",
  "SECURITY",
  "PERFORMANCE",
  "INTEGRATION"
]);

export const TestCaseSchema = z.object({
  testCaseId: z.string().min(1, "Test Case ID is required"),
  testCaseKey: z.string().min(1, "Test case business key is required"), // e.g. TC-LOGIN-001
  contractVersion: z.literal("1.0.0", {
    required_error: "Contract version is required",
    invalid_type_error: "Contract version must be '1.0.0'"
  }),
  testCaseName: z.string()
    .min(1, "Test case name is required")
    .max(150, "Test case name is too long"),
  testCaseType: TestCaseTypeSchema,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(10, "Description must be detailed"),
  preconditions: z.array(z.string()),
  steps: z.array(TestStepSchema).min(1, "Test case must have at least one step"),
  expectedResult: z.string().min(1, "Overall expected result is required"),
  evidence: z.array(z.string()),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), // Risk support
  coverageTargets: z.object({
    routes: z.array(z.string()),
    apis: z.array(z.string()),
    forms: z.array(z.string())
  }),
  testCaseOrigin: z.object({
    featureIds: z.array(z.string()),
    workflowIds: z.array(z.string()),
    scenarioIds: z.array(z.string())
  }),
  automationStatus: z.enum(["UNAUTOMATED", "AUTOMATED"]).default("UNAUTOMATED"),
  automationPath: z.string().nullable().optional()
});

export const TestCaseQualitySchema = z.object({
  testCaseId: z.string().min(1, "Test case ID is required"),
  qualityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  groundingScore: z.number().min(0).max(100),
  traceabilityScore: z.number().min(0).max(100),
  stepStructureScore: z.number().min(0).max(100),
  warnings: z.array(z.string())
});

export const TestCaseDiscoveryContextSchema = z.object({
  contextVersion: z.literal("1.0.0", {
    required_error: "Context version is required",
    invalid_type_error: "Context version must be '1.0.0'"
  }),
  builderMetadata: z.object({
    generatedAt: z.string(),
    scenariosCount: z.number()
  }),
  scenarios: z.array(
    z.object({
      id: z.string(),
      scenarioName: z.string(),
      scenarioType: z.string(),
      priority: z.string(),
      description: z.string(),
      evidence: z.array(z.string()),
      sourceWorkflows: z.array(z.string()),
      coverageTargets: z.object({
        routes: z.array(z.string()),
        apis: z.array(z.string()),
        forms: z.array(z.string())
      }),
      qualityScore: z.number().nullable()
    })
  ).min(1, "Scenarios list cannot be empty"),
  candidateAssets: z.object({
    routes: z.array(z.string()),
    apis: z.array(z.string()),
    forms: z.array(z.string())
  }),
  testCaseReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  })
});

export const TestCaseDiscoveryOutputSchema = z.object({
  generationMetadata: z.object({
    generatedAt: z.string(),
    generatedCount: z.number(),
    discardedCount: z.number()
  }),
  testCases: z.array(TestCaseSchema)
});

export const TestCaseQualityScorecardSchema = z.object({
  evaluationVersion: z.literal("1.0.0", {
    required_error: "Evaluation version is required",
    invalid_type_error: "Evaluation version must be '1.0.0'"
  }),
  overallTestCaseQualityScore: z.number().min(0).max(100),
  totalTestCasesEvaluated: z.number(),
  passingTestCasesCount: z.number(),
  failingTestCasesCount: z.number(),
  testCasesEvaluations: z.array(TestCaseQualitySchema),
  testCaseGenerationReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  }),
  globalWarnings: z.array(z.string())
});

export type TestStep = z.infer<typeof TestStepSchema>;
export type TestCaseType = z.infer<typeof TestCaseTypeSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestCaseQuality = z.infer<typeof TestCaseQualitySchema>;
export type TestCaseQualityScorecard = z.infer<typeof TestCaseQualityScorecardSchema>;
export type TestCaseDiscoveryContext = z.infer<typeof TestCaseDiscoveryContextSchema>;
export type TestCaseDiscoveryOutput = z.infer<typeof TestCaseDiscoveryOutputSchema>;

export function validateTestCaseDiscoveryOutput(payload: unknown): TestCaseDiscoveryOutput {
  return TestCaseDiscoveryOutputSchema.parse(payload);
}

export function validateTestCaseDiscoveryContext(payload: unknown): TestCaseDiscoveryContext {
  return TestCaseDiscoveryContextSchema.parse(payload);
}

export function validateTestCaseQualityScorecard(payload: unknown): TestCaseQualityScorecard {
  return TestCaseQualityScorecardSchema.parse(payload);
}
