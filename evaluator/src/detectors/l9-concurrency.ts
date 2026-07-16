// L9: race-safe writes under concurrency (docs/02-ai-resistance.md).
// "Check if the slot is free, then append" passes every sequential
// test and fails under two parallel requests. Fires N truly parallel
// reserve requests for the SAME slot via Promise.all and asserts
// exactly one 201 and the rest 409.
//
// Dynamic, black-box: only the reserve HTTP endpoint. The submission's
// own append-with-expected-version pattern (or lack of it) is checked
// indirectly, through observed behavior, never by reading its code. A
// supplementary grep for `.append(` call sites is included as an
// explainer in detail only; it never decides the verdict (the main
// explainer for this lives in static-greps.ts).

import path from 'node:path';
import { exec, psql } from '../lib/exec.js';
import { looksLikeMissingRoute, postJson } from '../lib/http.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

const N = 10;

async function grepAppendCalls(sub: string): Promise<string[]> {
  const result = await exec('grep', ['-rn', String.raw`\.append\(`, path.join(sub, 'packages/api/src')]);
  return result.stdout.split('\n').filter(Boolean).slice(0, 20);
}

export interface L9Detail {
  slotId: string;
  n: number;
  statuses: number[];
  wins: number;
  conflicts: number;
  other: number[];
  append_calls_explainer: string[];
}

export async function runL9(ctx: DetectorContext): Promise<DetectorResult<L9Detail>> {
  const sub = ctx.submissionDir;

  const candidateIdsRaw = await psql(`SELECT id FROM candidates_rm ORDER BY random() LIMIT ${N}`, sub);
  const candidateIds = candidateIdsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  const slotId = await psql('SELECT id FROM slots_rm ORDER BY random() LIMIT 1', sub);

  if (!slotId || candidateIds.length < N) {
    return { id: 'L9', verdict: 'MISSING', evidence: 'not enough candidates/slots in the read models to run the concurrency probe' };
  }

  // Probe first: does the reserve endpoint exist at all? A bogus
  // candidate id on a real route still answers (likely a domain "not
  // found", also a 404, but with this app's own error shape). Nest's
  // own fallback for an unmatched route has a distinct shape
  // (statusCode + "Cannot POST ..."), which is what tells "feature
  // absent" apart from "feature present, this id is bogus".
  const routeProbe = await postJson(`${ctx.apiUrl}/candidates/__evaluator-probe__/reservations`, {
    slotId: '__evaluator-probe-slot__',
  });
  if (routeProbe.status === 0 || looksLikeMissingRoute(routeProbe.body)) {
    return { id: 'L9', verdict: 'MISSING', evidence: 'reserve endpoint not found; reservations are not implemented in this submission' };
  }

  const results = await Promise.all(
    candidateIds.map((cid) => postJson(`${ctx.apiUrl}/candidates/${cid}/reservations`, { slotId })),
  );

  const statuses = results.map((r) => r.status);
  const wins = statuses.filter((s) => s === 201).length;
  const conflicts = statuses.filter((s) => s === 409).length;
  const other = statuses.filter((s) => s !== 201 && s !== 409);

  const detail: L9Detail = {
    slotId,
    n: N,
    statuses,
    wins,
    conflicts,
    other,
    append_calls_explainer: await grepAppendCalls(sub),
  };

  if (wins === 1 && conflicts === N - 1) {
    return {
      id: 'L9',
      verdict: 'CLEAN',
      evidence: `exactly one 201 and ${N - 1} 409(s) out of ${N} truly parallel reserve requests for the same slot`,
      detail,
    };
  }
  return {
    id: 'L9',
    verdict: 'TRIPPED',
    evidence: `race condition: ${wins} request(s) got 201 (expected exactly 1) out of ${N} parallel requests for the same slot; statuses=${JSON.stringify(statuses)}`,
    detail,
  };
}
