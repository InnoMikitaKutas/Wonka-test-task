// L8: cross-language contract drift (docs/02-ai-resistance.md). The
// analytics service hand-mirrors the TypeScript event registry in
// Pydantic. If the submission ships new event types (the reservation
// feature) without updating services/analytics/app/events.py, GET
// /health on analytics must surface them in ignored_event_types
// instead of silently dropping them.
//
// Dynamic, black-box: HTTP against the analytics service, plus one DB
// read via psql to cross-check /funnel's total. Never imports the
// submission's Python or TypeScript modules.

import { psql } from '../lib/exec.js';
import { asRecord, getJson } from '../lib/http.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

export interface L8Detail {
  status: unknown;
  ignored_event_types: string[];
  funnel_total: unknown;
  candidates_rm_count: number;
}

export async function runL8(ctx: DetectorContext): Promise<DetectorResult<L8Detail>> {
  const health = await getJson(`${ctx.analyticsUrl}/health`);
  if (health.status === 0) {
    return { id: 'L8', verdict: 'MISSING', evidence: 'analytics service is unreachable' };
  }
  const healthBody = asRecord(health.body);
  if (health.status !== 200) {
    return { id: 'L8', verdict: 'TRIPPED', evidence: `GET /health returned ${health.status}` };
  }

  const funnel = await getJson(`${ctx.analyticsUrl}/funnel`);
  if (funnel.status !== 200) {
    return { id: 'L8', verdict: 'TRIPPED', evidence: `GET /funnel returned ${funnel.status}` };
  }
  const funnelBody = asRecord(funnel.body);

  const ignored = Array.isArray(healthBody.ignored_event_types)
    ? healthBody.ignored_event_types.filter((x): x is string => typeof x === 'string')
    : [];
  const candidateCount = Number(await psql('SELECT count(*) FROM candidates_rm', ctx.submissionDir));
  const funnelTotal = funnelBody.total;

  const ignoredEmpty = ignored.length === 0;
  const funnelMatches = funnelTotal === candidateCount;

  const detail: L8Detail = {
    status: healthBody.status,
    ignored_event_types: ignored,
    funnel_total: funnelTotal,
    candidates_rm_count: candidateCount,
  };

  if (ignoredEmpty && funnelMatches) {
    return { id: 'L8', verdict: 'CLEAN', evidence: 'ignored_event_types is empty and /funnel total matches candidates_rm', detail };
  }

  const problems: string[] = [];
  if (!ignoredEmpty) problems.push(`ignored_event_types is not empty: ${ignored.join(', ')} (analytics does not know about these event types yet)`);
  if (!funnelMatches) problems.push(`funnel total ${String(funnelTotal)} != candidates_rm count ${candidateCount}`);
  return { id: 'L8', verdict: 'TRIPPED', evidence: problems.join('; '), detail };
}
