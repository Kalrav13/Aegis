import { z } from 'zod';
import { IntelligenceManifestSchema, InteractionRegistrySchema } from './manifest.schema';
import { RepositoryUnderstandingSchema, InferenceMetaDataSchema, QualityScorecardSchema } from './understanding.schema';
import { AiReadyContextSchema } from './context.schema';
import { FeatureSchema, FeatureDiscoveryOutputSchema, DiscoveryContextSchema } from './feature.schema';

export * from './manifest.schema';
export * from './understanding.schema';
export * from './context.schema';
export * from './feature.schema';
export * from './feature-quality.schema';
export * from './scenario.schema';
export * from './scenario-quality.schema';
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
