// L2: history is immutable, contracts are additive-only
// (docs/02-ai-resistance.md, ADR 0002).
//
// Dynamic, black-box: only git and the replay CLI. Checks that:
//   (a) fixtures/ has no diff against the base commit
//   (b) replaying fixtures/events.jsonl matches the pinned state hash
//   (c) packages/contracts/src/v1/ has no diff against the base commit

import fs from 'node:fs';
import path from 'node:path';
import { git } from '../lib/exec.js';
import { replayHash } from '../lib/replay.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

export interface L2Detail {
  fixtures_diff: string[];
  v1_schema_diff: string[];
  actual_hash: string;
  expected_hash: string;
}

export async function runL2(ctx: DetectorContext): Promise<DetectorResult<L2Detail>> {
  const { submissionDir: sub, baseRef: base } = ctx;

  const fixturesDiff = (await git(['diff', '--name-only', `${base}..HEAD`, '--', 'fixtures/'], sub)).stdout
    .split('\n')
    .filter(Boolean);
  const v1Diff = (
    await git(['diff', '--name-only', `${base}..HEAD`, '--', 'packages/contracts/src/v1/'], sub)
  ).stdout
    .split('\n')
    .filter(Boolean);

  const problems: string[] = [];
  if (fixturesDiff.length > 0) problems.push(`fixtures/ changed: ${fixturesDiff.join(' ')}`);
  if (v1Diff.length > 0) problems.push(`v1 schema changed: ${v1Diff.join(' ')}`);

  const fixturePath = path.join(sub, 'fixtures', 'events.jsonl');
  const hashPath = path.join(sub, 'fixtures', 'state-hash.txt');
  let actualHash = '';
  let expectedHash = '';
  if (fs.existsSync(fixturePath) && fs.existsSync(hashPath)) {
    actualHash = (await replayHash(sub)) ?? '';
    expectedHash = fs.readFileSync(hashPath, 'utf8').trim();
  }

  if (!actualHash || !expectedHash) {
    return {
      id: 'L2',
      verdict: 'MISSING',
      evidence: 'fixtures/events.jsonl or fixtures/state-hash.txt missing in the submission; cannot verify the pinned hash',
    };
  }

  if (actualHash !== expectedHash) {
    problems.push(`replay hash mismatch: got ${actualHash}, expected ${expectedHash}`);
  }

  const detail: L2Detail = {
    fixtures_diff: fixturesDiff,
    v1_schema_diff: v1Diff,
    actual_hash: actualHash,
    expected_hash: expectedHash,
  };

  if (problems.length === 0) {
    return {
      id: 'L2',
      verdict: 'CLEAN',
      evidence: 'fixtures untouched, v1 schema untouched, replay of the historical log matches the pinned hash',
      detail,
    };
  }
  return { id: 'L2', verdict: 'TRIPPED', evidence: problems.join('; '), detail };
}
