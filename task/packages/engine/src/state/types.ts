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

export interface Reservation {
  id: string;
  slotId: string;
  candidateId: string;
  status: 'pending' | 'confirmed' | 'expired';
  expiresAt: string;
}

export interface State {
  candidates: Record<string, Candidate>;
  slots: Record<string, Slot>;
  reservations: Record<string, Reservation>;
}
