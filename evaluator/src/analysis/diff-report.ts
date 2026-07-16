// Stage 3: structured facts about the diff against the base commit.
// Scope, churn, dependency changes, plus the raw signals render.ts
// needs to synthesize the MANUAL-assisted L6/L7 entries (NOTES.md
// content, whether legacy/holds.ts was touched). Not a verdict-bearing
// detector, just data for the scorecard's Process section and the
// defense agenda.

import fs from 'node:fs';
import path from 'node:path';
import { git } from '../lib/exec.js';
import { addedRuntimeDeps } from '../lib/pnpm-lock.js';

const ALLOWLIST = [
  /^packages\/contracts\//,
  /^packages\/engine\//,
  /^packages\/api\//,
  /^packages\/projector\//,
  /^services\/analytics\//,
  /^tools\/replay\//,
  /^NOTES\.md$/,
  /(^|\/)(test|tests)\//,
  /\.(spec|test)\.(ts|py)$/,
];

function inAllowlist(file: string): boolean {
  return ALLOWLIST.some((re) => re.test(file));
}

export interface NotesMdSignals {
  present: boolean;
  mentions_ttl_ambiguity: boolean;
  mentions_ai_usage: boolean;
  mentions_legacy_holds: boolean;
  excerpt: string;
}

export interface DiffReport {
  base: string;
  changed_files: string[];
  churn: { insertions: number; deletions: number; total: number };
  scope: { outside_allowlist: string[] };
  dependency_changes: { added_runtime_deps: string[]; lockfile_changed: boolean };
  legacy_holds_touched: boolean;
  notes_md: NotesMdSignals;
}

const EMPTY_NOTES: NotesMdSignals = {
  present: false,
  mentions_ttl_ambiguity: false,
  mentions_ai_usage: false,
  mentions_legacy_holds: false,
  excerpt: '',
};

export async function buildDiffReport(submissionDir: string, baseRef: string): Promise<DiffReport> {
  const changedFiles = (await git(['diff', '--name-only', `${baseRef}..HEAD`], submissionDir)).stdout
    .split('\n')
    .filter(Boolean);
  const shortstat = (await git(['diff', '--shortstat', `${baseRef}..HEAD`], submissionDir)).stdout;
  const insertions = Number(shortstat.match(/(\d+) insertion/)?.[1] ?? 0);
  const deletions = Number(shortstat.match(/(\d+) deletion/)?.[1] ?? 0);

  const outsideAllowlist = changedFiles.filter((f) => f !== 'pnpm-lock.yaml' && !inAllowlist(f));

  const oldLockText = (await git(['show', `${baseRef}:pnpm-lock.yaml`], submissionDir)).stdout;
  const newLockPath = path.join(submissionDir, 'pnpm-lock.yaml');
  const newLockText = fs.existsSync(newLockPath) ? fs.readFileSync(newLockPath, 'utf8') : '';
  const addedRuntime = addedRuntimeDeps(oldLockText, newLockText);

  const legacyHoldsTouched = changedFiles.includes('packages/api/src/legacy/holds.ts');

  let notesMd = EMPTY_NOTES;
  const notesPath = path.join(submissionDir, 'NOTES.md');
  if (fs.existsSync(notesPath)) {
    const text = fs.readFileSync(notesPath, 'utf8');
    notesMd = {
      present: true,
      mentions_ttl_ambiguity: /\b(12\s*h|24\s*h|ttl|techlead|tech lead|ambiguity|ambiguous)\b/i.test(text),
      mentions_ai_usage: /\b(ai|claude|copilot|chatgpt|gpt|cursor|agent)\b/i.test(text),
      mentions_legacy_holds: /holds\.ts|legacy\/holds/i.test(text),
      excerpt: text.slice(0, 2000),
    };
  }

  return {
    base: baseRef,
    changed_files: changedFiles,
    churn: { insertions, deletions, total: insertions + deletions },
    scope: { outside_allowlist: outsideAllowlist },
    dependency_changes: { added_runtime_deps: addedRuntime, lockfile_changed: changedFiles.includes('pnpm-lock.yaml') },
    legacy_holds_touched: legacyHoldsTouched,
    notes_md: notesMd,
  };
}
