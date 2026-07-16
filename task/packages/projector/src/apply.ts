import {
  ApplicationReceivedPayload,
  InterviewScheduledPayload,
  OfferExtendedPayload,
  ScoreAssignedPayload,
  SlotOpenedPayload,
  StageChangedPayload,
} from '@ats/contracts';
import type {
  CandidateReadModelRepository,
  SlotReadModelRepository,
  StoredEvent,
} from '@ats/persistence';

// The read-model repositories applyEvent writes through.
export interface ReadModelRepositories {
  candidateReadModel: CandidateReadModelRepository;
  slotReadModel: SlotReadModelRepository;
}

// Applies one event to the read models (candidates_rm, slots_rm).
// Every branch calls a repository upsert, so applying the same event
// twice leaves the row unchanged, since delivery is at-least-once
// (ADR 0004). Each payload is parsed with its contracts schema, which
// both validates it and gives it a concrete type, no cast needed.
export async function applyEvent(
  repos: ReadModelRepositories,
  event: StoredEvent,
): Promise<void> {
  switch (event.type) {
    case 'ApplicationReceived': {
      const payload = ApplicationReceivedPayload.parse(event.payload);
      await repos.candidateReadModel.upsertOnApplication(
        payload.candidateId,
        payload.name,
        payload.position,
        payload.source,
        event.occurredAt,
      );
      return;
    }
    case 'StageChanged': {
      const payload = StageChangedPayload.parse(event.payload);
      await repos.candidateReadModel.updateStage(
        payload.candidateId,
        payload.toStage,
        event.occurredAt,
      );
      return;
    }
    case 'ScoreAssigned': {
      const payload = ScoreAssignedPayload.parse(event.payload);
      await repos.candidateReadModel.updateScore(
        payload.candidateId,
        payload.score,
        event.occurredAt,
      );
      return;
    }
    case 'OfferExtended': {
      const payload = OfferExtendedPayload.parse(event.payload);
      await repos.candidateReadModel.setOfferNote(
        payload.candidateId,
        payload.note,
        event.occurredAt,
      );
      return;
    }
    case 'SlotOpened': {
      const payload = SlotOpenedPayload.parse(event.payload);
      await repos.slotReadModel.upsertOnOpen(
        payload.slotId,
        payload.interviewer,
        payload.startsAt,
      );
      return;
    }
    case 'InterviewScheduled': {
      const payload = InterviewScheduledPayload.parse(event.payload);
      await repos.slotReadModel.setScheduledCandidate(
        payload.slotId,
        payload.candidateId,
      );
      return;
    }
    default: {
      // The projector must tolerate event types it does not know yet:
      // contracts only grow (ADR 0002), and a newer producer may write
      // an event type this build was never told about. Log and skip
      // instead of crashing the whole catch-up run.
      console.warn(`projector: skipping unknown event type "${event.type}"`);
      return;
    }
  }
}
