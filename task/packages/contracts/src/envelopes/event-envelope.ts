import { z } from 'zod';

// occurredAt is assigned once at the API edge, when the command is
// accepted. Events inherit it from their command. See docs/adr/0001.
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  type: z.string(),
  stream: z.string(),
  streamVersion: z.number().int().min(1),
  schemaVersion: z.literal(1),
  occurredAt: z.string().datetime(),
  // Refined per event type by the schemas in events/schemas.ts.
  payload: z.unknown(),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
