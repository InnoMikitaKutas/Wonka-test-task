import type { EventStoreRepository, ProjectorStateRepository } from '@ats/persistence';
import { applyEvent, type ReadModelRepositories } from './apply';

// Everything catchUp needs: the event log to read from, the read models
// to write through, and the checkpoint that remembers where it stopped.
export interface ProjectorDeps extends ReadModelRepositories {
  eventStore: EventStoreRepository;
  projectorState: ProjectorStateRepository;
}

// How many events readAfter fetches per round trip.
const BATCH_SIZE = 500;

// Projects every event newer than the last applied position onto the
// read models, strictly in global_seq order. Returns the number of
// events processed.
//
// last_seq advances right after each event is applied, so a crash
// mid-run only ever redoes the one event it did not finish recording,
// and apply.ts's handlers are idempotent anyway (ADR 0004). Re-running
// catchUp once it is caught up reads an empty batch and processes 0.
export async function catchUp(deps: ProjectorDeps): Promise<number> {
  let lastSeq = await deps.projectorState.getLastSeq();
  let processed = 0;

  for (;;) {
    const batch = await deps.eventStore.readAfter(lastSeq, BATCH_SIZE);
    if (batch.length === 0) {
      break;
    }

    // TODO(perf): this loop processes events one by one. If the backlog
    // grows, look into parallelizing here.
    for (const event of batch) {
      await applyEvent(deps, event);
      await deps.projectorState.setLastSeq(event.globalSeq);
      lastSeq = event.globalSeq;
      processed += 1;
    }
  }

  return processed;
}
