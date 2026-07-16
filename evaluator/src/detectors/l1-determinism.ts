// L1: replay determinism (docs/02-ai-resistance.md, ADR 0001).
//
// Dynamic, black-box: runs the submission's own `pnpm replay` command
// twice over fixtures/events.jsonl and compares the two printed state
// hashes. Never imports the submission's internal modules.

import fs from 'node:fs';
import path from 'node:path';
import { replayHash } from '../lib/replay.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

export interface L1Detail {
  hash1: string;
  hash2: string;
}

const FIXTURE_REL = 'fixtures/events.jsonl';

export async function runL1(ctx: DetectorContext): Promise<DetectorResult<L1Detail>> {
  if (!fs.existsSync(path.join(ctx.submissionDir, FIXTURE_REL))) {
    return { id: 'L1', verdict: 'MISSING', evidence: `${FIXTURE_REL} not found in the submission` };
  }

  const hash1 = await replayHash(ctx.submissionDir, FIXTURE_REL);
  const hash2 = await replayHash(ctx.submissionDir, FIXTURE_REL);

  if (!hash1 || !hash2) {
    return {
      id: 'L1',
      verdict: 'MISSING',
      evidence: 'pnpm replay did not print a state hash (command failed or produced no output)',
    };
  }

  if (hash1 === hash2) {
    return {
      id: 'L1',
      verdict: 'CLEAN',
      evidence: `double replay of ${FIXTURE_REL} produced the same hash (${hash1})`,
      detail: { hash1, hash2 },
    };
  }
  return {
    id: 'L1',
    verdict: 'TRIPPED',
    evidence: `double replay of ${FIXTURE_REL} produced different hashes: ${hash1} vs ${hash2}`,
    detail: { hash1, hash2 },
  };
}
