import type { CommandEnvelope, EventDraft, EventEnvelope } from '@ats/contracts';
import { decide, initialState, reduce } from '@ats/engine';
import type { EventStoreRepository, NewEvent, StoredEvent } from '@ats/persistence';
import type { IdGenerator } from './id.service';

// The store always writes schemaVersion 1. This narrows the column's
// plain number type back to the literal EventEnvelope expects.
function toEventEnvelope(event: StoredEvent): EventEnvelope {
  return {
    eventId: event.eventId,
    type: event.type,
    stream: event.stream,
    streamVersion: event.streamVersion,
    schemaVersion: event.schemaVersion as 1,
    occurredAt: event.occurredAt,
    payload: event.payload,
  };
}

// Shared write path for every command: fold the events on the read
// streams into a state slice, ask the engine what it decides, then
// append the resulting events to the target stream under optimistic
// concurrency. A version conflict from append propagates unchanged as
// an OptimisticConcurrencyError.
export async function runCommand(
  eventStore: EventStoreRepository,
  idGenerator: IdGenerator,
  command: CommandEnvelope,
  readStreams: string[],
  targetStream: string,
): Promise<EventDraft[]> {
  const stored = await eventStore.loadStreams(readStreams);
  const state = stored.reduce(
    (acc, event) => reduce(acc, toEventEnvelope(event)),
    initialState(),
  );
  const drafts = decide(state, command);
  // The expected version must come from the same snapshot used by decide.
  // Reading it again after the decision would reopen a check-then-act race.
  const expectedVersion = stored
    .filter((event) => event.stream === targetStream)
    .reduce((max, event) => Math.max(max, event.streamVersion), 0);
  const events: NewEvent[] = drafts.map((draft) => ({
    eventId: idGenerator.next(),
    type: draft.type,
    payload: draft.payload,
    occurredAt: command.occurredAt,
  }));
  await eventStore.append(targetStream, events, expectedVersion);
  return drafts;
}
