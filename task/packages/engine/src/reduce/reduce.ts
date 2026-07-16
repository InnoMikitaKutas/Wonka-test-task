import type {
  ApplicationReceived,
  EventEnvelope,
  InterviewScheduled,
  OfferExtended,
  ScoreAssigned,
  SlotOpened,
  StageChanged,
} from '@ats/contracts';
import { DomainError } from '../errors';
import type { State } from '../state';

// Applies one event to the state and returns a new state.
// Only the touched entity is copied; untouched maps are shared.
export function reduce(state: State, envelope: EventEnvelope): State {
  switch (envelope.type) {
    case 'ApplicationReceived': {
      const p = envelope.payload as ApplicationReceived;
      return {
        ...state,
        candidates: {
          ...state.candidates,
          [p.candidateId]: {
            id: p.candidateId,
            name: p.name,
            position: p.position,
            source: p.source,
            stage: 1,
            score: null,
            offerNote: null,
          },
        },
      };
    }
    case 'StageChanged': {
      const p = envelope.payload as StageChanged;
      const candidate = state.candidates[p.candidateId];
      return {
        ...state,
        candidates: {
          ...state.candidates,
          [p.candidateId]: { ...candidate, stage: p.toStage },
        },
      };
    }
    case 'ScoreAssigned': {
      const p = envelope.payload as ScoreAssigned;
      const candidate = state.candidates[p.candidateId];
      return {
        ...state,
        candidates: {
          ...state.candidates,
          [p.candidateId]: { ...candidate, score: p.score },
        },
      };
    }
    case 'OfferExtended': {
      const p = envelope.payload as OfferExtended;
      const candidate = state.candidates[p.candidateId];
      return {
        ...state,
        candidates: {
          ...state.candidates,
          [p.candidateId]: { ...candidate, offerNote: p.note },
        },
      };
    }
    case 'SlotOpened': {
      const p = envelope.payload as SlotOpened;
      return {
        ...state,
        slots: {
          ...state.slots,
          [p.slotId]: {
            id: p.slotId,
            interviewer: p.interviewer,
            startsAt: p.startsAt,
            scheduledCandidateId: null,
          },
        },
      };
    }
    case 'InterviewScheduled': {
      const p = envelope.payload as InterviewScheduled;
      const slot = state.slots[p.slotId];
      return {
        ...state,
        slots: {
          ...state.slots,
          [p.slotId]: { ...slot, scheduledCandidateId: p.candidateId },
        },
      };
    }
    default:
      throw new DomainError('VALIDATION', `unknown event type ${envelope.type}`);
  }
}
