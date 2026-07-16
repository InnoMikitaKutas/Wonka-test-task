// The landmine detector list Stage 2 runs. functional (Stage 1) is
// imported separately since render.ts needs its detail typed
// precisely for scoring, not just carried through as-is.

import type { DetectorContext, DetectorResult } from '../lib/types.js';
import { runL1 } from './l1-determinism.js';
import { runL2 } from './l2-immutability.js';
import { runL3 } from './l3-ordering.js';
import { runL4 } from './l4-golden.js';
import { runL5 } from './l5-scope.js';
import { runL8 } from './l8-drift.js';
import { runL9 } from './l9-concurrency.js';
import { runStaticGreps } from './static-greps.js';

export { runFunctional } from './functional.js';
export type { FunctionalCriteria, FunctionalDetail, FunctionalResult, FunctionalStretch, StretchGoalResult } from './functional.js';

export interface LandmineDetector {
  id: string;
  run: (ctx: DetectorContext) => Promise<DetectorResult>;
}

export const landmineDetectors: LandmineDetector[] = [
  { id: 'L1', run: runL1 },
  { id: 'L2', run: runL2 },
  { id: 'L3', run: runL3 },
  { id: 'L4', run: runL4 },
  { id: 'L5', run: runL5 },
  { id: 'L8', run: runL8 },
  { id: 'L9', run: runL9 },
  { id: 'STATIC', run: runStaticGreps },
];
