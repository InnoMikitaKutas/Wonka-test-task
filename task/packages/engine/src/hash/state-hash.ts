import { createHash } from 'node:crypto';
import type { State } from '../state';
import { canonicalStringify } from './canonical';

export function stateHash(state: State): string {
  return createHash('sha256').update(canonicalStringify(state)).digest('hex');
}
