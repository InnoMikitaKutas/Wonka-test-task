import type {
  ApplicationReceived,
  EventEnvelope,
  InterviewScheduled,
  OfferExtended,
  ScoreAssigned,
  SlotOpened,
  StageChanged,
  ReservationPlaced,
  ReservationConfirmed,
  ReservationExpired,
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
    case 'ReservationPlaced': {
      const p = envelope.payload as ReservationPlaced;
      return {
        ...state,
        reservations: {
          ...state.reservations,
          [p.reservationId]: {
            id: p.reservationId,
            slotId: p.slotId,
            candidateId: p.candidateId,
            status: 'pending',
            expiresAt: p.expiresAt,
          },
        },
      };
    }
    case 'ReservationConfirmed': {
      const p = envelope.payload as ReservationConfirmed;
      const reservation = state.reservations[p.reservationId];
      return {
        ...state,
        reservations: {
          ...state.reservations,
          [p.reservationId]: { ...reservation, status: 'confirmed' },
        },
      };
    }
    case 'ReservationExpired': {
      const p = envelope.payload as ReservationExpired;
      const reservation = state.reservations[p.reservationId];
      return {
        ...state,
        reservations: {
          ...state.reservations,
          [p.reservationId]: { ...reservation, status: 'expired' },
        },
      };
    }
    default:
      throw new DomainError('VALIDATION', `unknown event type ${envelope.type}`);
  }
}
