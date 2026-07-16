export interface Candidate {
  id: string;
  name: string;
  position: string;
  source: string;
  stage: number;
  score: string | null;
  offerNote: string | null;
}

export interface Slot {
  id: string;
  interviewer: string;
  startsAt: string;
  scheduledCandidateId: string | null;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'expired';

export interface Reservation {
  id: string;
  slotId: string;
  candidateId: string;
  reservedAt: string;
  expiresAt: string;
  status: ReservationStatus;
}

export interface State {
  candidates: Record<string, Candidate>;
  slots: Record<string, Slot>;
  // Optional preserves the historical state hash when a log contains no
  // reservation events. It is materialized by the first reservation event.
  reservations?: Record<string, Reservation>;
}
