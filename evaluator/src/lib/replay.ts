// Shared helper: run the submission's own replay CLI and pull the
// printed state hash out of its output. Used by L1, L2, L4, and the
// functional detector, so the hash regex lives in exactly one place.

import { exec } from './exec.js';

const HASH_RE = /state=(sha256:[0-9a-f]{64})/;

export async function replayHash(
  submissionDir: string,
  fixtureRel = 'fixtures/events.jsonl',
  extraArgs: string[] = [],
): Promise<string | null> {
  const result = await exec('pnpm', ['replay', '--', '--file', fixtureRel, ...extraArgs], { cwd: submissionDir });
  const match = result.stdout.match(HASH_RE);
  return match ? match[1] : null;
}
