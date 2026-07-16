import { z } from 'zod';
import {
  AssignScorePayload,
  ChangeStagePayload,
  ExtendOfferPayload,
  OpenSlotPayload,
  ScheduleInterviewPayload,
  SubmitApplicationPayload,
  ReserveSlotPayload,
  ConfirmReservationPayload,
  SweepPayload,
} from './schemas';

export type SubmitApplication = z.infer<typeof SubmitApplicationPayload>;
export type ChangeStage = z.infer<typeof ChangeStagePayload>;
export type AssignScore = z.infer<typeof AssignScorePayload>;
export type ExtendOffer = z.infer<typeof ExtendOfferPayload>;
export type OpenSlot = z.infer<typeof OpenSlotPayload>;
export type ScheduleInterview = z.infer<typeof ScheduleInterviewPayload>;
export type ReserveSlot = z.infer<typeof ReserveSlotPayload>;
export type ConfirmReservation = z.infer<typeof ConfirmReservationPayload>;
export type Sweep = z.infer<typeof SweepPayload>;
