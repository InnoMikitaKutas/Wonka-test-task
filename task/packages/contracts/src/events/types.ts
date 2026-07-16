import { z } from 'zod';
import {
  ApplicationReceivedPayload,
  InterviewScheduledPayload,
  OfferExtendedPayload,
  ScoreAssignedPayload,
  SlotOpenedPayload,
  StageChangedPayload,
} from './schemas';

export type ApplicationReceived = z.infer<typeof ApplicationReceivedPayload>;
export type StageChanged = z.infer<typeof StageChangedPayload>;
export type ScoreAssigned = z.infer<typeof ScoreAssignedPayload>;
export type OfferExtended = z.infer<typeof OfferExtendedPayload>;
export type SlotOpened = z.infer<typeof SlotOpenedPayload>;
export type InterviewScheduled = z.infer<typeof InterviewScheduledPayload>;
