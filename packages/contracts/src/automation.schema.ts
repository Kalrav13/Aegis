import { z } from 'zod';
import { TestCaseSchema } from './test-case.schema';

export const AutomationFrameworkSchema = z.enum(["PLAYWRIGHT", "CYPRESS", "SELENIUM", "WEBDRIVERIO"]);

export const AutomationScriptSchema = z.object({
  scriptId: z.string().uuid("Invalid script UUID"),
  testCaseId: z.string().uuid("Invalid test case UUID"),
  contractVersion: z.literal("1.0.0", {
    required_error: "Contract version is required",
    invalid_type_error: "Contract version must be '1.0.0'"
  }),
  filePath: z.string().min(1, "File path is required"),
  codeContent: z.string().min(1, "Code content is required"),
  framework: AutomationFrameworkSchema,
  confidenceScore: z.number().min(0).max(1.0, "Confidence score must be between 0.0 and 1.0"),
  automationOrigin: z.object({
    featureIds: z.array(z.string()),
    scenarioIds: z.array(z.string()),
    testCaseIds: z.array(z.string()),
    workflowIds: z.array(z.string())
  })
});

export const AutomationDiscoveryContextSchema = z.object({
  contextVersion: z.literal("1.0.0", {
    required_error: "Context version is required",
    invalid_type_error: "Context version must be '1.0.0'"
  }),
  targetFramework: AutomationFrameworkSchema,
  testCases: z.array(TestCaseSchema).min(1, "At least one test case is required to compile automation context"),
  interactionRegistry: z.object({
    elements: z.array(
      z.object({
        elementId: z.string().min(1, "Element ID is required"),
        elementName: z.string().min(1, "Element name is required"),
        selector: z.string().min(1, "Selector string is required"),
        pageRoute: z.string().min(1, "Page route is required")
      })
    ),
    routes: z.array(z.string()),
    apis: z.array(z.string()),
    forms: z.array(z.string())
  }),
  frameworkConfiguration: z.object({
    configurationVersion: z.literal("1.0.0", {
      required_error: "Configuration version is required",
      invalid_type_error: "Configuration version must be '1.0.0'"
    }),
    framework: AutomationFrameworkSchema,
    language: z.string().min(1, "Language is required"),
    testStructure: z.string().min(1, "Test structure is required")
  }),
  automationGenerationReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  })
});

export const AutomationGenerationOutputSchema = z.object({
  generationMetadata: z.object({
    generatedAt: z.string(),
    scriptsCount: z.number().int().nonnegative(),
    failuresCount: z.number().int().nonnegative()
  }),
  scripts: z.array(AutomationScriptSchema)
});

export const AutomationQualitySchema = z.object({
  id: z.string().uuid("Invalid quality UUID"),
  scriptId: z.string().uuid("Invalid script UUID"),
  qualityScore: z.number().min(0).max(100, "Quality score must be between 0 and 100"),
  syntaxScore: z.number().min(0).max(100),
  complianceScore: z.number().min(0).max(100),
  maintainabilityScore: z.number().min(0).max(100),
  groundingScore: z.number().min(0).max(100),
  traceabilityScore: z.number().min(0).max(100),
  crossFileIntegrityScore: z.number().min(0).max(100),
  warnings: z.array(z.string())
});

export const AutomationQualityScorecardSchema = z.object({
  evaluationVersion: z.literal("1.0.0", {
    required_error: "Evaluation version is required",
    invalid_type_error: "Evaluation version must be '1.0.0'"
  }),
  generatedAt: z.string(),
  scriptsCount: z.number().int().nonnegative(),
  failuresCount: z.number().int().nonnegative(),
  overallQualityScore: z.number().min(0).max(100),
  automationExecutionReadiness: z.object({
    ready: z.boolean(),
    blockingReasons: z.array(z.string())
  })
});

export type AutomationFramework = z.infer<typeof AutomationFrameworkSchema>;
export type AutomationScript = z.infer<typeof AutomationScriptSchema>;
export type AutomationDiscoveryContext = z.infer<typeof AutomationDiscoveryContextSchema>;
export type AutomationGenerationOutput = z.infer<typeof AutomationGenerationOutputSchema>;
export type AutomationQuality = z.infer<typeof AutomationQualitySchema>;
export type AutomationQualityScorecard = z.infer<typeof AutomationQualityScorecardSchema>;

export function validateAutomationScript(payload: unknown): AutomationScript {
  return AutomationScriptSchema.parse(payload);
}

export function validateAutomationDiscoveryContext(payload: unknown): AutomationDiscoveryContext {
  return AutomationDiscoveryContextSchema.parse(payload);
}

export function validateAutomationGenerationOutput(payload: unknown): AutomationGenerationOutput {
  return AutomationGenerationOutputSchema.parse(payload);
}

export function validateAutomationQuality(payload: unknown): AutomationQuality {
  return AutomationQualitySchema.parse(payload);
}

export function validateAutomationQualityScorecard(payload: unknown): AutomationQualityScorecard {
  return AutomationQualityScorecardSchema.parse(payload);
}

