import { IntelligenceManifestSchema, InteractionRegistrySchema } from './manifest.schema';
import { RepositoryUnderstandingSchema } from './understanding.schema';
import { AiReadyContextSchema } from './context.schema';

export function validateManifest(data: unknown) {
  return IntelligenceManifestSchema.parse(data);
}

export function validateRegistry(data: unknown) {
  return InteractionRegistrySchema.parse(data);
}

export function validateUnderstanding(data: unknown) {
  return RepositoryUnderstandingSchema.parse(data);
}

export function validateContext(data: unknown) {
  return AiReadyContextSchema.parse(data);
}
