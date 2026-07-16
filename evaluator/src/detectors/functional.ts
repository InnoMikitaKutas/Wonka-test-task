// Stage 1: black-box functional acceptance (docs/01-assignment.md,
// acceptance criteria 1-8, plus stretch S1/S2).
//
// Dynamic, black-box: the fixed REST contract, the replay CLI, the
// projections DB (via psql, to pick real ids to test with), and the
// documented `pnpm -r test` command. Never imports the submission's
// internal modules.
//
// A note on criteria 2 and 4: they describe behavior after a real 24
// hour TTL elapses. The evaluator cannot wait 24 real hours, and the
// fixed REST contract gives no endpoint to fast-forward the clock (per
// ADR 0001, time only enters through envelopes the API edge stamps
// with the real wall clock). That boundary is instead verified
// deterministically by criterion 8: the full test suite, including the
// formerly-skipped packages/engine/test/reservations.spec.ts tests,
// which exercise the exact TTL boundary with fixed, synthetic
// timestamps. Criteria 2 and 4 here only check the parts that are
// testable live: an immediate confirm, and the shape of endpoints.

import fs from 'node:fs';
import path from 'node:path';
import { exec, psql } from '../lib/exec.js';
import { asRecord, getJson, looksLikeMissingRoute, postJson } from '../lib/http.js';
import { replayHash } from '../lib/replay.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

export interface FunctionalCriteria {
  criterion_1_reserve_conflict: boolean | null;
  criterion_2_confirm_expiry: boolean | null;
  criterion_3_sweep: boolean | null;
  criterion_4_release_after_expiry: boolean | null;
  criterion_5_concurrency: boolean | null;
  criterion_6_analytics_health: boolean | null;
  criterion_7_determinism: boolean | null;
  criterion_8_full_suite: boolean | null;
}

export interface StretchGoalResult {
  attempted: boolean;
  passed: boolean;
}

export interface FunctionalStretch {
  S1: StretchGoalResult;
  S2: StretchGoalResult;
}

export interface FunctionalDetail {
  criteria: FunctionalCriteria;
  stretch: FunctionalStretch;
  notes: string[];
}

// Every branch of runFunctional sets detail, unlike most detectors
// where it is optional; render.ts relies on that to score without a
// fallback path.
export type FunctionalResult = DetectorResult<FunctionalDetail> & { detail: FunctionalDetail };

function emptyCriteria(): FunctionalCriteria {
  return {
    criterion_1_reserve_conflict: null,
    criterion_2_confirm_expiry: null,
    criterion_3_sweep: null,
    criterion_4_release_after_expiry: null,
    criterion_5_concurrency: null,
    criterion_6_analytics_health: null,
    criterion_7_determinism: null,
    criterion_8_full_suite: null,
  };
}

function emptyStretch(): FunctionalStretch {
  return { S1: { attempted: false, passed: false }, S2: { attempted: false, passed: false } };
}

async function freshId(sub: string, table: string): Promise<string> {
  return psql(`SELECT id FROM ${table} ORDER BY random() LIMIT 1`, sub);
}

async function checkDeterminism(sub: string): Promise<boolean> {
  const a = await replayHash(sub);
  const b = await replayHash(sub);
  return a !== null && a === b;
}

// Sums every jest "Tests:  X skipped, ..." summary line across all
// packages pnpm -r test runs through. Anchored on "Tests:" (not "Test
// Suites:"), since jest prints both and only the former counts
// individual formerly-skipped `it()` cases.
function countSkippedTests(output: string): number {
  const matches = output.matchAll(/Tests:\s*(\d+)\s+skipped/gi);
  let total = 0;
  for (const m of matches) total += Number(m[1]);
  return total;
}

async function checkFullSuite(sub: string, notes: string[]): Promise<boolean> {
  const result = await exec('pnpm', ['-r', 'test'], { cwd: sub, timeoutMs: 10 * 60 * 1000 });
  const skippedCount = countSkippedTests(result.stdout + result.stderr);
  if (result.code === 0) {
    notes.push(`criterion 8: pnpm -r test exited 0, ${skippedCount} test(s) still skipped`);
    return skippedCount === 0;
  }
  notes.push(`criterion 8: pnpm -r test FAILED (non-zero exit), ${skippedCount} test(s) skipped`);
  return false;
}

async function checkAnalyticsHealthEmpty(analyticsUrl: string): Promise<boolean> {
  const health = await getJson(`${analyticsUrl}/health`);
  const ignored = asRecord(health.body).ignored_event_types;
  return Array.isArray(ignored) && ignored.length === 0;
}

export async function runFunctional(ctx: DetectorContext): Promise<FunctionalResult> {
  const sub = ctx.submissionDir;
  const notes: string[] = [];
  const criteria = emptyCriteria();
  const stretch = emptyStretch();

  try {
    const routeProbe = await postJson(`${ctx.apiUrl}/candidates/__evaluator-probe__/reservations`, {
      slotId: '__evaluator-probe-slot__',
    });
    const routeMissing = routeProbe.status === 0 || looksLikeMissingRoute(routeProbe.body);

    if (routeMissing) {
      // Feature-independent criteria are still worth checking and
      // reporting, even when reservations were never shipped.
      criteria.criterion_7_determinism = await checkDeterminism(sub);
      criteria.criterion_8_full_suite = await checkFullSuite(sub, notes);
      criteria.criterion_6_analytics_health = await checkAnalyticsHealthEmpty(ctx.analyticsUrl);
      return {
        id: 'functional',
        verdict: 'MISSING',
        evidence: 'reserve endpoint 404s: reservations are not implemented in this submission',
        detail: { criteria, stretch, notes },
      };
    }

    // --- criterion 1: reserve, then a conflicting reserve on the same slot ---
    const slotA = await freshId(sub, 'slots_rm');
    const candidate1 = await freshId(sub, 'candidates_rm');
    const candidate2 = await freshId(sub, 'candidates_rm');
    let reservationId: string | null = null;

    if (slotA && candidate1) {
      const first = await postJson(`${ctx.apiUrl}/candidates/${candidate1}/reservations`, { slotId: slotA });
      const second = await postJson(`${ctx.apiUrl}/candidates/${candidate2 || candidate1}/reservations`, {
        slotId: slotA,
      });
      const firstBody = asRecord(first.body);
      const firstOk =
        first.status === 201 &&
        firstBody.status === 'pending' &&
        typeof firstBody.reservationId === 'string' &&
        typeof firstBody.expiresAt === 'string';
      const secondOk = second.status === 409;
      criteria.criterion_1_reserve_conflict = firstOk && secondOk;
      if (firstOk && typeof firstBody.reservationId === 'string') reservationId = firstBody.reservationId;
      notes.push(`criterion 1: first reserve=${first.status}, conflicting reserve=${second.status}`);
    } else {
      notes.push('criterion 1: not enough slots/candidates in the read models to test with');
    }

    // --- criterion 2: confirm while pending and not expired (the ---
    // --- expired -> 410 boundary is covered by criterion 8, see the ---
    // --- header comment) ---
    if (reservationId) {
      const confirm = await postJson(`${ctx.apiUrl}/reservations/${reservationId}/confirm`, {});
      const confirmBody = asRecord(confirm.body);
      criteria.criterion_2_confirm_expiry = confirm.status === 200 && confirmBody.status === 'confirmed';
      notes.push(`criterion 2 (immediate confirm only): confirm=${confirm.status}`);
    }

    // --- criterion 3: sweep endpoint shape ---
    const sweep = await postJson(`${ctx.apiUrl}/admin/sweep`, {});
    const sweepBody = asRecord(sweep.body);
    criteria.criterion_3_sweep = sweep.status === 200 && Number.isInteger(sweepBody.expired);
    notes.push(`criterion 3: sweep=${sweep.status} body=${JSON.stringify(sweep.body)}`);

    // --- criterion 4: not directly testable without a real 24h wait ---
    notes.push(
      'criterion 4 (slot released by expiry can be reserved again) is not directly testable here without ' +
        'a real 24h wait; it is implied by criteria 1, 3 and 8 passing together, and should be confirmed on the defense call',
    );

    // --- criterion 5: a light 2-way concurrency smoke check (the deep N=10 race test lives in L9) ---
    const slotB = await freshId(sub, 'slots_rm');
    if (slotB && candidate1 && candidate2) {
      const [r1, r2] = await Promise.all([
        postJson(`${ctx.apiUrl}/candidates/${candidate1}/reservations`, { slotId: slotB }),
        postJson(`${ctx.apiUrl}/candidates/${candidate2}/reservations`, { slotId: slotB }),
      ]);
      const statuses = [r1.status, r2.status].sort();
      criteria.criterion_5_concurrency = statuses[0] === 201 && statuses[1] === 409;
      notes.push(`criterion 5 (2-way smoke check; see L9 for the N=10 race test): statuses=${JSON.stringify(statuses)}`);
    } else {
      notes.push('criterion 5: not enough slots/candidates in the read models to test with');
    }

    // --- criterion 6: analytics stays clean after new events flowed through ---
    criteria.criterion_6_analytics_health = await checkAnalyticsHealthEmpty(ctx.analyticsUrl);

    // --- criterion 7: determinism ---
    criteria.criterion_7_determinism = await checkDeterminism(sub);

    // --- criterion 8: full suite green, including formerly-skipped tests ---
    criteria.criterion_8_full_suite = await checkFullSuite(sub, notes);

    // --- stretch S1: GET /reservations/summary on analytics ---
    const summary = await getJson(`${ctx.analyticsUrl}/reservations/summary`);
    const summaryBody = asRecord(summary.body);
    if (summary.status === 200) {
      stretch.S1.attempted = true;
      stretch.S1.passed = ['pending', 'confirmed', 'expired'].every((k) => Number.isInteger(summaryBody[k]));
    }

    // --- stretch S2: pnpm replay --until <ISO timestamp> ---
    const fixturePath = path.join(sub, 'fixtures', 'events.jsonl');
    if (fs.existsSync(fixturePath)) {
      const lines = fs.readFileSync(fixturePath, 'utf8').split('\n').filter(Boolean);
      if (lines.length > 0) {
        const last = asRecord(JSON.parse(lines[lines.length - 1]));
        if (typeof last.occurredAt === 'string') {
          const untilHash = await replayHash(sub, 'fixtures/events.jsonl', ['--until', last.occurredAt]);
          if (untilHash !== null) {
            const fullHash = await replayHash(sub);
            stretch.S2.attempted = true;
            stretch.S2.passed = untilHash === fullHash;
          }
        }
      }
    }

    const coreCriteria = [
      criteria.criterion_1_reserve_conflict,
      criteria.criterion_2_confirm_expiry,
      criteria.criterion_3_sweep,
      criteria.criterion_5_concurrency,
      criteria.criterion_6_analytics_health,
      criteria.criterion_7_determinism,
      criteria.criterion_8_full_suite,
    ];
    const passedCount = coreCriteria.filter((c) => c === true).length;
    const verdict = coreCriteria.every((c) => c === true) ? 'CLEAN' : 'TRIPPED';

    return {
      id: 'functional',
      verdict,
      evidence: `reservations endpoint present; ${passedCount}/${coreCriteria.length} directly-testable criteria passed`,
      detail: { criteria, stretch, notes },
    };
  } catch (err) {
    return {
      id: 'functional',
      verdict: 'MISSING',
      evidence: `error while probing the submission: ${err instanceof Error ? err.message : String(err)}`,
      detail: { criteria, stretch, notes },
    };
  }
}
