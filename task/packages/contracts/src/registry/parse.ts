import type { EventEnvelope } from '../envelopes';
import { EventEnvelopeSchema } from '../envelopes';
import { EVENT_PAYLOAD_SCHEMAS, isKnownType } from './event-registry';

// Parses one JSONL line into a validated event envelope.
// Throws with a clear message on bad JSON, bad envelope shape,
// unknown event type, or a payload that fails its schema.
export function parseEventLine(line: string): EventEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    throw new Error(`invalid JSON: ${line.slice(0, 80)}`);
  }

  const envelope = EventEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error(`invalid event envelope: ${envelope.error.message}`);
  }

  const { type } = envelope.data;
  if (!isKnownType(type)) {
    throw new Error(`unknown event type: ${type}`);
  }

  const payload = EVENT_PAYLOAD_SCHEMAS[type].safeParse(envelope.data.payload);
  if (!payload.success) {
    throw new Error(`invalid payload for ${type}: ${payload.error.message}`);
  }

  return { ...envelope.data, payload: payload.data };
}
