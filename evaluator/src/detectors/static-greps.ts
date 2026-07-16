// Static greps: explainers only, never a verdict on their own (see the
// "black box first" design rule in docs/03-evaluation.md). This always
// reports MANUAL; its only job is to point at the exact line to
// discuss on the defense call when a dynamic detector (L1, L3, L9)
// trips.

import fs from 'node:fs';
import path from 'node:path';
import { exec } from '../lib/exec.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

export interface StaticGrepsDetail {
  l1_time_or_random_hits: string[];
  l3_parallel_loop_hits: string[];
  l9_append_call_sites: string[];
}

async function grepDir(pattern: string, dir: string): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const result = await exec('grep', ['-rnE', pattern, dir]);
  return result.stdout.split('\n').filter(Boolean);
}

export async function runStaticGreps(ctx: DetectorContext): Promise<DetectorResult<StaticGrepsDetail>> {
  const sub = ctx.submissionDir;

  // L1 explainer: engine and projector must never read the clock or
  // use randomness (ADR 0001, R3).
  const timeOrRandomHits = [
    ...(await grepDir('Date\\.now\\(\\)|new Date\\(|Math\\.random', path.join(sub, 'packages/engine/src'))),
    ...(await grepDir('Date\\.now\\(\\)|new Date\\(|Math\\.random', path.join(sub, 'packages/projector/src'))),
  ];

  // L3 explainer: the projector loop is sequential on purpose (ADR
  // 0004); the bait TODO(perf) comment invites parallelizing it.
  const parallelLoopHits = await grepDir('Promise\\.all|p-map|pMap\\(', path.join(sub, 'packages/projector/src'));

  // L9 explainer: every write should go through append(stream, drafts,
  // expectedVersion). This only lists call sites; it does not verify
  // an expected version is actually passed, that needs a human or the
  // L9 dynamic race test to confirm.
  const appendCallSites = await grepDir('\\.append\\(', path.join(sub, 'packages/api/src'));

  return {
    id: 'STATIC',
    verdict: 'MANUAL',
    evidence: `explainer greps only, this never decides a verdict: ${timeOrRandomHits.length} Date.now/new Date/Math.random hit(s) in engine+projector (L1 context), ${parallelLoopHits.length} Promise.all/p-map hit(s) in projector (L3 context), ${appendCallSites.length} .append( call site(s) in api (L9 context)`,
    detail: {
      l1_time_or_random_hits: timeOrRandomHits,
      l3_parallel_loop_hits: parallelLoopHits,
      l9_append_call_sites: appendCallSites,
    },
  };
}
