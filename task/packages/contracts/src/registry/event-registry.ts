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
} from '../events';

export const EVENT_TYPES = [
  'ApplicationReceived',
  'StageChanged',
  'ScoreAssigned',
  'OfferExtended',
  'SlotOpened',
  'InterviewScheduled',
  'ReservationPlaced',
  'ReservationConfirmed',
  'ReservationExpired',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_PAYLOAD_SCHEMAS: Record<EventType, z.ZodTypeAny> = {
  ApplicationReceived: ApplicationReceivedPayload,
  StageChanged: StageChangedPayload,
  ScoreAssigned: ScoreAssignedPayload,
  OfferExtended: OfferExtendedPayload,
  SlotOpened: SlotOpenedPayload,
  InterviewScheduled: InterviewScheduledPayload,
  ReservationPlaced: ReservationPlacedPayload,
  ReservationConfirmed: ReservationConfirmedPayload,
  ReservationExpired: ReservationExpiredPayload,
};

export function isKnownType(type: string): type is EventType {
  return (EVENT_TYPES as readonly string[]).includes(type);
}
