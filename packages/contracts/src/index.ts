import { z } from 'zod';

export const DummySchema = z.object({
  id: z.string()
});

export type DummyType = z.infer<typeof DummySchema>;
