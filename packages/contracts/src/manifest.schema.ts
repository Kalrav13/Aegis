import { z } from 'zod';

export const IntelligenceManifestSchema = z.object({
  version_metadata: z.object({
    commit_sha: z.string(),
    timestamp: z.string()
  }),
  directories: z.object({
    paths: z.array(z.string()),
    total_directories: z.number()
  }),
  package_files: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["npm", "composer", "cargo", "bundler", "go", "python", "maven", "gradle"])
    })
  ),
  config_files: z.array(
    z.object({
      path: z.string(),
      type: z.string()
    })
  ),
  route_candidates: z.array(
    z.object({
      path: z.string(),
      framework_context: z.enum(["pages", "app", "routes", "unknown"])
    })
  ),
  api_candidates: z.array(
    z.object({
      path: z.string(),
      method_hint: z.string().nullable()
    })
  ),
  component_candidates: z.array(
    z.object({
      path: z.string(),
      framework: z.enum(["react", "vue", "unknown"])
    })
  ),
  statistics: z.object({
    total_filtered_files: z.number(),
    total_filtered_size_bytes: z.number(),
    file_type_distribution: z.record(z.number())
  })
});

export const InteractionRegistrySchema = z.object({
  ui_elements: z.array(
    z.object({
      path: z.string(),
      type: z.enum(["button", "input", "form", "select", "textarea"]),
      attributes: z.object({
        dataTestId: z.string().optional(),
        id: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional()
      })
    })
  ),
  api_endpoints: z.array(
    z.object({
      path: z.string(),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      route: z.string(),
      parameters: z.array(z.string())
    })
  )
});
