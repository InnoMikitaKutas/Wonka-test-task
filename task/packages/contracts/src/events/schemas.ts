// The v1 event schema surface. Released events never change shape or
// meaning. See docs/adr/0002.
import { z } from 'zod';
import { scoreString, stageIndex } from './primitives';

export const ApplicationReceivedPayload = z.object({
  candidateId: z.string(),
  name: z.string(),
  position: z.string(),
  source: z.string(),
});

export const StageChangedPayload = z.object({
  candidateId: z.string(),
  fromStage: stageIndex,
  toStage: stageIndex,
});

export const ScoreAssignedPayload = z.object({
  candidateId: z.string(),
  score: scoreString,
  assessor: z.string(),
});

export const OfferExtendedPayload = z.object({
  candidateId: z.string(),
  note: z.string(),
});

export const SlotOpenedPayload = z.object({
  slotId: z.string(),
  interviewer: z.string(),
  startsAt: z.string().datetime(),
});

export const InterviewScheduledPayload = z.object({
  slotId: z.string(),
  candidateId: z.string(),
});

export const ReservationPlacedPayload = z.object({
  reservationId: z.string(),
  slotId: z.string(),
  candidateId: z.string(),
  expiresAt: z.string().datetime(),
});

export const ReservationConfirmedPayload = z.object({
  reservationId: z.string(),
  slotId: z.string(),
});

export const ReservationExpiredPayload = z.object({
  reservationId: z.string(),
  slotId: z.string(),
});

export const V1Event = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ApplicationReceived'),
    payload: ApplicationReceivedPayload,
  }),
  z.object({ type: z.literal('StageChanged'), payload: StageChangedPayload }),
  z.object({ type: z.literal('ScoreAssigned'), payload: ScoreAssignedPayload }),
  z.object({ type: z.literal('OfferExtended'), payload: OfferExtendedPayload }),
  z.object({ type: z.literal('SlotOpened'), payload: SlotOpenedPayload }),
  z.object({
    type: z.literal('InterviewScheduled'),
    payload: InterviewScheduledPayload,
  }),
]);
