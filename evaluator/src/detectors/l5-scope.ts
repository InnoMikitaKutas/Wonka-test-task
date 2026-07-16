// L5: scope discipline (docs/01-assignment.md rules R4-R5).
//
// Dynamic, black-box: only `git diff` against the base commit. Looks
// at which files changed, how much churn there was, and whether
// pnpm-lock.yaml grew new runtime dependencies. Never TRIPPED on its
// own: a file outside the allowlist or a new dependency is flagged
// MANUAL, because a justified case documented in NOTES.md is allowed.

import fs from 'node:fs';
import path from 'node:path';
import { git } from '../lib/exec.js';
import { addedRuntimeDeps } from '../lib/pnpm-lock.js';
import type { DetectorContext, DetectorResult } from '../lib/types.js';

// The packages/services the assignment names as in scope, plus
// NOTES.md and any test file anywhere in the tree.
const ALLOWLIST_RE =
  /^(packages\/contracts\/|packages\/engine\/|packages\/api\/|packages\/projector\/|services\/analytics\/|tools\/replay\/|NOTES\.md$)|(^|\/)(test|tests)\/|\.(spec|test)\.(ts|py)$/;

function inAllowlist(file: string): boolean {
  return ALLOWLIST_RE.test(file);
}

export interface L5Detail {
  changed_files: string[];
  outside_allowlist: string[];
  added_runtime_deps: string[];
  churn: { insertions: number; deletions: number; total: number };
}

export async function runL5(ctx: DetectorContext): Promise<DetectorResult<L5Detail>> {
  const { submissionDir: sub, baseRef: base } = ctx;

  const changedFiles = (await git(['diff', '--name-only', `${base}..HEAD`], sub)).stdout.split('\n').filter(Boolean);
  const shortstat = (await git(['diff', '--shortstat', `${base}..HEAD`], sub)).stdout;
  const insertions = Number(shortstat.match(/(\d+) insertion/)?.[1] ?? 0);
  const deletions = Number(shortstat.match(/(\d+) deletion/)?.[1] ?? 0);

  const outsideAllowlist = changedFiles.filter((f) => f !== 'pnpm-lock.yaml' && !inAllowlist(f));

  const oldLockText = (await git(['show', `${base}:pnpm-lock.yaml`], sub)).stdout;
  const newLockPath = path.join(sub, 'pnpm-lock.yaml');
  const newLockText = fs.existsSync(newLockPath) ? fs.readFileSync(newLockPath, 'utf8') : '';
  const addedDeps = addedRuntimeDeps(oldLockText, newLockText);

  const detail: L5Detail = {
    changed_files: changedFiles,
    outside_allowlist: outsideAllowlist,
    added_runtime_deps: addedDeps,
    churn: { insertions, deletions, total: insertions + deletions },
  };

  if (outsideAllowlist.length > 0 || addedDeps.length > 0) {
    const parts: string[] = [];
    if (outsideAllowlist.length > 0) parts.push(`files outside the allowlist: ${outsideAllowlist.join(' ')}`);
    if (addedDeps.length > 0) parts.push(`new runtime dependencies in pnpm-lock.yaml: ${JSON.stringify(addedDeps)}`);
    return { id: 'L5', verdict: 'MANUAL', evidence: `${parts.join('; ')} (churn: ${detail.churn.total} lines)`, detail };
  }
  return {
    id: 'L5',
    verdict: 'CLEAN',
    evidence: `diff stays inside the allowlist, no new runtime dependencies (churn: ${detail.churn.total} lines)`,
    detail,
  };
}
