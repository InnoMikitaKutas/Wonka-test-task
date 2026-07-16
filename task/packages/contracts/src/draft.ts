// What the engine returns from decide. The edge completes a draft into
// a full envelope: eventId is generated there, occurredAt is copied
// from the command, streamVersion comes from the event store.
export interface EventDraft {
  type: string;
  stream: string;
  payload: unknown;
}
