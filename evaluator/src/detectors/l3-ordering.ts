// L3: per-aggregate ordering and idempotency in the projector, under
// at-least-once delivery (docs/02-ai-resistance.md, ADR 0004).
//
// Dynamic, black-box: runs the submission's own projector command
// twice against the real database, with a forced rewind in between to
// simulate redelivery. Only touches the DB (via psql) and the
// documented `pnpm --filter @ats/projector project` command; never
// imports the submission's projector modules directly. Static greps
// for Promise.all in the projector loop are an explainer only, see
// static-greps.ts; they never decide this verdict.

import { exec, psql } from '../lib/exec.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

interface Snapshot {
  counts: { candidates: number; slots: number };
  checksum: string;
}

export interface L3Detail {
  before: Snapshot;
  after?: Snapshot;
  output?: string;
}

async function runProjector(sub: string): Promise<{ ok: boolean; output: string }> {
  const result = await exec('pnpm', ['--filter', '@ats/projector', 'project'], { cwd: sub, timeoutMs: 2 * 60 * 1000 });
  return { ok: result.code === 0, output: result.stdout + result.stderr };
}

// One deterministic checksum across both read models the projector
// maintains. Row order is pinned with ORDER BY id so the checksum only
// changes if the actual content changes.
async function checksum(sub: string): Promise<string> {
  const c = await psql("SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY id)), 'empty') FROM candidates_rm t", sub);
  const s = await psql("SELECT coalesce(md5(string_agg(t::text, '|' ORDER BY id)), 'empty') FROM slots_rm t", sub);
  return `${c}:${s}`;
}

async function counts(sub: string): Promise<{ candidates: number; slots: number }> {
  return {
    candidates: Number(await psql('SELECT count(*) FROM candidates_rm', sub)),
    slots: Number(await psql('SELECT count(*) FROM slots_rm', sub)),
  };
}

async function snapshot(sub: string): Promise<Snapshot> {
  return { counts: await counts(sub), checksum: await checksum(sub) };
}

export async function runL3(ctx: DetectorContext): Promise<DetectorResult<L3Detail>> {
  const sub = ctx.submissionDir;

  // Make sure the projector has caught up at least once before we
  // start measuring.
  const first = await runProjector(sub);
  if (!first.ok) {
    return {
      id: 'L3',
      verdict: 'MISSING',
      evidence: 'the projector could not run once; cannot test idempotency',
      detail: { before: { counts: { candidates: 0, slots: 0 }, checksum: '' }, output: first.output.slice(0, 500) },
    };
  }

  const before = await snapshot(sub);

  // Force redelivery: rewind the projector's own bookmark to 0, so the
  // next catch-up run reprocesses every event from the start. A
  // correctly idempotent projector (upserts, ADR 0004) leaves the read
  // models unchanged; one that inserts blindly either crashes on a
  // unique-key violation or duplicates rows.
  await psql('UPDATE projector_state SET last_seq = 0 WHERE id = 1', sub);

  const second = await runProjector(sub);
  if (!second.ok) {
    return {
      id: 'L3',
      verdict: 'TRIPPED',
      evidence: 'the projector crashed on redelivery, likely an INSERT without ON CONFLICT (not idempotent)',
      detail: { before, output: second.output.slice(0, 1000) },
    };
  }

  const after = await snapshot(sub);
  const sameCounts = before.counts.candidates === after.counts.candidates && before.counts.slots === after.counts.slots;
  const sameChecksum = before.checksum === after.checksum;

  if (sameCounts && sameChecksum) {
    return {
      id: 'L3',
      verdict: 'CLEAN',
      evidence: 'rewinding projector_state.last_seq and re-running the projector left candidates_rm/slots_rm unchanged',
      detail: { before, after },
    };
  }
  return {
    id: 'L3',
    verdict: 'TRIPPED',
    evidence: `read models changed after forced redelivery: counts ${JSON.stringify(before.counts)} -> ${JSON.stringify(after.counts)}, checksum ${sameChecksum ? 'unchanged' : 'changed'}`,
    detail: { before, after },
  };
}
