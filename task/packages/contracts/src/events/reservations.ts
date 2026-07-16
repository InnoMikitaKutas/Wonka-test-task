import { z } from 'zod';

export const ReservationPlacedPayload = z.object({
  reservationId: z.string(),
  slotId: z.string(),
  candidateId: z.string(),
  expiresAt: z.string().datetime(),
});

export const ReservationConfirmedPayload = z.object({
  reservationId: z.string(),
});

export const ReservationExpiredPayload = z.object({
  reservationId: z.string(),
});

export type ReservationPlaced = z.infer<typeof ReservationPlacedPayload>;
export type ReservationConfirmed = z.infer<typeof ReservationConfirmedPayload>;
export type ReservationExpired = z.infer<typeof ReservationExpiredPayload>;
