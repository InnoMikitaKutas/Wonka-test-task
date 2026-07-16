import { createHash } from 'node:crypto';
import type { State } from '../state';
import { canonicalStringify } from './canonical';

export function stateHash(state: State): string {
  // Keep the byte representation of v1-only history unchanged. Once a
  // reservation exists it becomes part of the state hash as normal.
  const value = Object.keys(state.reservations).length
    ? state
    : { candidates: state.candidates, slots: state.slots };
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}
