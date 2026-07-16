import type { CommandEnvelope, EventDraft } from '@ats/contracts';
import {
  AssignScorePayload,
  ChangeStagePayload,
  ConfirmReservationPayload,
  ExtendOfferPayload,
  OpenSlotPayload,
  ReserveSlotPayload,
  ScheduleInterviewPayload,
  SubmitApplicationPayload,
  SweepPayload,
} from '@ats/contracts';
import { DomainError } from '../errors';
import type { State } from '../state';

export const RESERVATION_TTL_HOURS = 24;
const RESERVATION_TTL_MS = RESERVATION_TTL_HOURS * 60 * 60 * 1000;

function timestamp(value: string): number {
  return Date.parse(value);
}

function expiresAt(occurredAt: string): string {
  // This is a deterministic conversion of envelope data, not a wall-clock read.
  return new globalThis.Date(timestamp(occurredAt) + RESERVATION_TTL_MS).toISOString();
}

function isActiveReservation(
  reservation: NonNullable<State['reservations']>[string],
  occurredAt: string,
): boolean {
  return (
    reservation.status === 'confirmed' ||
    (reservation.status === 'pending' &&
      timestamp(occurredAt) < timestamp(reservation.expiresAt))
  );
}

// Turns a command into the events it produces, or throws a DomainError.
// Pure: no I/O, no clock, no id generation. The edge fills in eventId,
// occurredAt (from the command), and streamVersion. See docs/adr/0001.
export function decide(state: State, command: CommandEnvelope): EventDraft[] {
  switch (command.type) {
    case 'SubmitApplication': {
      const p = SubmitApplicationPayload.parse(command.payload);
      if (state.candidates[p.candidateId]) {
        throw new DomainError('CONFLICT', `candidate ${p.candidateId} already exists`);
      }
      return [
        { type: 'ApplicationReceived', stream: `candidate-${p.candidateId}`, payload: p },
      ];
    }
    case 'ChangeStage': {
      const p = ChangeStagePayload.parse(command.payload);
      const candidate = state.candidates[p.candidateId];
      if (!candidate) {
        throw new DomainError('NOT_FOUND', `candidate ${p.candidateId} not found`);
      }
      if (p.toStage === candidate.stage) {
        throw new DomainError('VALIDATION', `candidate is already at stage ${p.toStage}`);
      }
      return [
        {
          type: 'StageChanged',
          stream: `candidate-${p.candidateId}`,
          payload: {
            candidateId: p.candidateId,
            fromStage: candidate.stage,
            toStage: p.toStage,
          },
        },
      ];
    }
    case 'AssignScore': {
      const p = AssignScorePayload.parse(command.payload);
      if (!state.candidates[p.candidateId]) {
        throw new DomainError('NOT_FOUND', `candidate ${p.candidateId} not found`);
      }
      return [
        { type: 'ScoreAssigned', stream: `candidate-${p.candidateId}`, payload: p },
      ];
    }
    case 'ExtendOffer': {
      const p = ExtendOfferPayload.parse(command.payload);
      const candidate = state.candidates[p.candidateId];
      if (!candidate) {
        throw new DomainError('NOT_FOUND', `candidate ${p.candidateId} not found`);
      }
      if (candidate.stage !== 4) {
        throw new DomainError(
          'VALIDATION',
          'an offer can only be extended at the offer stage (4)',
        );
      }
      return [
        { type: 'OfferExtended', stream: `candidate-${p.candidateId}`, payload: p },
      ];
    }
    case 'OpenSlot': {
      const p = OpenSlotPayload.parse(command.payload);
      if (state.slots[p.slotId]) {
        throw new DomainError('CONFLICT', `slot ${p.slotId} already exists`);
      }
      return [{ type: 'SlotOpened', stream: `slot-${p.slotId}`, payload: p }];
    }
    case 'ScheduleInterview': {
      const p = ScheduleInterviewPayload.parse(command.payload);
      const slot = state.slots[p.slotId];
      if (!slot) {
        throw new DomainError('NOT_FOUND', `slot ${p.slotId} not found`);
      }
      if (slot.scheduledCandidateId) {
        throw new DomainError('CONFLICT', `slot ${p.slotId} is already scheduled`);
      }
      const candidate = state.candidates[p.candidateId];
      if (!candidate) {
        throw new DomainError('NOT_FOUND', `candidate ${p.candidateId} not found`);
      }
      if (candidate.stage < 3) {
        throw new DomainError(
          'VALIDATION',
          'candidate must be at the interview stage (3) or later',
        );
      }
      return [{ type: 'InterviewScheduled', stream: `slot-${p.slotId}`, payload: p }];
    }
    case 'ReserveSlot': {
      const p = ReserveSlotPayload.parse(command.payload);
      const slot = state.slots[p.slotId];
      if (slot?.scheduledCandidateId) {
        throw new DomainError('CONFLICT', `slot ${p.slotId} is already scheduled`);
      }
      if (state.reservations?.[p.reservationId]) {
        throw new DomainError(
          'CONFLICT',
          `reservation ${p.reservationId} already exists`,
        );
      }
      const held = Object.values(state.reservations ?? {}).some(
        (reservation) =>
          reservation.slotId === p.slotId &&
          isActiveReservation(reservation, command.occurredAt),
      );
      if (held) {
        throw new DomainError('CONFLICT', `slot ${p.slotId} has an active reservation`);
      }
      return [
        {
          type: 'ReservationPlaced',
          stream: `slot-${p.slotId}`,
          payload: { ...p, expiresAt: expiresAt(command.occurredAt) },
        },
      ];
    }
    case 'ConfirmReservation': {
      const p = ConfirmReservationPayload.parse(command.payload);
      const reservation = state.reservations?.[p.reservationId];
      if (!reservation) {
        throw new DomainError('NOT_FOUND', `reservation ${p.reservationId} not found`);
      }
      if (reservation.status === 'expired') {
        throw new DomainError('GONE', `reservation ${p.reservationId} has expired`);
      }
      if (reservation.status === 'confirmed') {
        throw new DomainError(
          'CONFLICT',
          `reservation ${p.reservationId} is already confirmed`,
        );
      }
      if (timestamp(command.occurredAt) >= timestamp(reservation.expiresAt)) {
        throw new DomainError('GONE', `reservation ${p.reservationId} has expired`);
      }
      return [
        {
          type: 'ReservationConfirmed',
          stream: `slot-${reservation.slotId}`,
          payload: p,
        },
      ];
    }
    case 'Sweep': {
      SweepPayload.parse(command.payload);
      return Object.values(state.reservations ?? {})
        .filter(
          (reservation) =>
            reservation.status === 'pending' &&
            timestamp(command.occurredAt) >= timestamp(reservation.expiresAt),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((reservation) => ({
          type: 'ReservationExpired',
          stream: `slot-${reservation.slotId}`,
          payload: { reservationId: reservation.id },
        }));
    }
    default:
      throw new DomainError('VALIDATION', `unknown command type ${command.type}`);
  }
}
