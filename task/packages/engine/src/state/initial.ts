import type { State } from './types';

export function initialState(): State {
  return { candidates: {}, slots: {}, reservations: {} };
}
