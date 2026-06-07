import { z } from 'zod';

export const AiReadyContextSchema = z.object({
  metadata: z.object({
    commit_sha: z.string(),
    timestamp: z.string(),
    total_files: z.number(),
    total_size_bytes: z.number(),
    file_extensions: z.record(z.number())
  }),
  tech_stack: z.object({
    package_managers: z.array(z.string()),
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    config_profiles: z.array(z.string())
  }),
  routes_and_apis: z.array(
    z.object({
      route: z.string(),
      type: z.enum(["page", "api", "unknown"]),
      methods: z.array(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])),
      parameters: z.array(z.string()),
      files: z.array(z.string())
    })
  ),
  forms: z.array(
    z.object({
      path: z.string(),
      form_id: z.string().optional(),
      form_name: z.string().optional(),
      test_id: z.string().optional(),
      inputs: z.array(
        z.object({
          name: z.string().optional(),
          id: z.string().optional(),
          type: z.string().optional(),
          test_id: z.string().optional()
        })
      ),
      submit_buttons: z.array(
        z.object({
          id: z.string().optional(),
          test_id: z.string().optional()
        })
      )
    })
  ),
  components_summary: z.object({
    count: z.number(),
    frameworks: z.array(z.string()),
    locations: z.array(z.string())
  }),
  evidence_index: z.record(z.array(z.string()))
});
