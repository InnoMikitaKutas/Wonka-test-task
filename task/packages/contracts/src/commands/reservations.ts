import { z } from 'zod';

export const ReserveSlotPayload = z.object({
  reservationId: z.string(),
  slotId: z.string(),
  candidateId: z.string(),
});

export const ConfirmReservationPayload = z.object({
  reservationId: z.string(),
});

export const SweepPayload = z.object({}).strict();

export type ReserveSlot = z.infer<typeof ReserveSlotPayload>;
export type ConfirmReservation = z.infer<typeof ConfirmReservationPayload>;
export type Sweep = z.infer<typeof SweepPayload>;
