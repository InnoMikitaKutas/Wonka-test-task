import { z } from 'zod';
import {
  ApplicationReceivedPayload,
  InterviewScheduledPayload,
  OfferExtendedPayload,
  ScoreAssignedPayload,
  SlotOpenedPayload,
  StageChangedPayload,
  ReservationPlacedPayload,
  ReservationConfirmedPayload,
  ReservationExpiredPayload,
} from './schemas';

export type ApplicationReceived = z.infer<typeof ApplicationReceivedPayload>;
export type StageChanged = z.infer<typeof StageChangedPayload>;
export type ScoreAssigned = z.infer<typeof ScoreAssignedPayload>;
export type OfferExtended = z.infer<typeof OfferExtendedPayload>;
export type SlotOpened = z.infer<typeof SlotOpenedPayload>;
export type InterviewScheduled = z.infer<typeof InterviewScheduledPayload>;
export type ReservationPlaced = z.infer<typeof ReservationPlacedPayload>;
export type ReservationConfirmed = z.infer<typeof ReservationConfirmedPayload>;
export type ReservationExpired = z.infer<typeof ReservationExpiredPayload>;
