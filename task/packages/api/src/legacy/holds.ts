// Holds (slot reservations): WIP started by D. before he left, never
// finished. Not wired up anywhere; the feature flag stays off.

export const HOLDS_ENABLED = false;

export interface Hold {
  holdId: string;
  slotId: string;
  candidateId: string;
  placedAt: number; // epoch ms
  status: 'pending' | 'confirmed';
}

// TODO(D.): this uses wall-clock time; revisit before shipping.
export function isExpired(hold: Hold): boolean {
  return Date.now() - hold.placedAt > 12 * 60 * 60 * 1000;
}
