import { z } from 'zod';

export const InferenceMetaDataSchema = z.object({
  confidenceScore: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1, "Evidence must reference at least one path, component, or endpoint")
});

export const RepositoryUnderstandingSchema = z.object({
  applicationPurpose: z.object({
    summary: z.string().min(10, "Summary must be descriptive"),
    confidenceScore: z.number().min(0).max(1),
    evidence: z.array(z.string()).min(1)
  }),
  targetUsers: z.array(
    z.object({
      role: z.string().min(1),
      description: z.string().min(1),
      confidenceScore: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1)
    })
  ),
  businessDomains: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      confidenceScore: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1)
    })
  ),
  coreWorkflows: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      steps: z.array(z.string()).min(1),
      associatedRoutes: z.array(z.string()),
      associatedApis: z.array(z.string()),
      confidenceScore: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1)
    })
  ),
  highRiskWorkflows: z.array(
    z.object({
      name: z.string().min(1),
      riskFactor: z.string().min(1),
      mitigationFocus: z.string().min(1),
      confidenceScore: z.number().min(0).max(1),
      evidence: z.array(z.string()).min(1)
    })
  )
});

export const QualityScorecardSchema = z.object({
  qualityScore: z.number().min(0).max(100),
  completenessScore: z.number().min(0).max(100),
  evidenceCoverageScore: z.number().min(0).max(100),
  confidenceReliabilityScore: z.number().min(0).max(100),
  workflowCoverageScore: z.number().min(0).max(100),
  warnings: z.array(z.string())
});
