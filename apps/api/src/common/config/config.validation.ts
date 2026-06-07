import { z } from 'zod';

export const environmentSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  PORT: z.coerce.number().default(3001),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters long')
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateConfig(config: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(config);
  if (!result.success) {
    console.error('❌ Invalid Environment Variables Configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Invalid environment variables configuration');
  }
  return result.data;
}
