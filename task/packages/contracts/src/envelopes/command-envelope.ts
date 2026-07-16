import { z } from 'zod';

export const CommandEnvelopeSchema = z.object({
  commandId: z.string().uuid(),
  type: z.string(),
  occurredAt: z.string().datetime(),
  payload: z.unknown(),
});

export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
