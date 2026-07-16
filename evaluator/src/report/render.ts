// Builds the scorecard from every detector/analysis result run.ts
// collected, applies rubric.config.json, and writes scorecard.json and
// scorecard.md into evaluator/report/.

import fs from 'node:fs';
import path from 'node:path';
import type { DiffReport, NotesMdSignals } from '../analysis/diff-report.js';
import type { HistoryReport } from '../analysis/history-report.js';
import type { FunctionalCriteria, FunctionalResult, StretchGoalResult } from '../detectors/functional.js';
import type { DetectorResult, Rubric, Verdict } from '../lib/types.js';

const LANDMINE_NAMES: Record<string, string> = {
  L1: 'Replay determinism',
  L2: 'History immutability / additive contracts',
  L3: 'Projector ordering & idempotency',
  L4: 'Legacy compatibility (1-based stage, string score)',
  L5: 'Scope discipline',
  L6: 'Ambiguity handling (TTL 12h vs 24h)',
  L7: 'Judgment on legacy/holds.ts',
  L8: 'Cross-language contract drift (analytics)',
  L9: 'Race-safe concurrent writes',
};

export interface RunResults {
  functional: FunctionalResult;
  landmines: Record<string, DetectorResult>;
  staticExplainers: DetectorResult;
  diffReport: DiffReport;
  historyReport: HistoryReport;
}

export interface RunMeta {
  submission: string;
  seed: string;
  base: string;
}

interface PendingManualEntry {
  id: string;
  weight: number;
  evidence: string;
}

interface TrippedLandmineEntry {
  id: string;
  evidence: string;
  detail: unknown;
}

export interface Scorecard {
  meta: { submission: string; seed: string; base: string; generated_at: string };
  functional: {
    verdict: Verdict;
    score: number;
    max: number;
    criteria: FunctionalCriteria;
    detail: FunctionalResult['detail'];
  };
  landmines: Record<string, DetectorResult>;
  static_explainers: DetectorResult;
  process: {
    notes: { score: number; max: number; notes_md: NotesMdSignals };
    ambiguity: { score: number; max: number };
    commits: { score: number; max: number; history: HistoryReport };
  };
  stretch: {
    S1: StretchGoalResult & { points: number; max: number };
    S2: StretchGoalResult & { points: number; max: number };
    total: number;
    max: number;
  };
  scoring: {
    automated_subtotal: number;
    base_max: number;
    pending_manual_review: PendingManualEntry[];
    pending_manual_max: number;
    range_pending_manual_review: [number, number];
    stretch_bonus: number;
    final_range_with_stretch: [number, number];
  };
  recovery_rule: string;
  defense_agenda: string[];
  diff_report: DiffReport;
  history_report: HistoryReport;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildAgenda(
  trippedLandmines: TrippedLandmineEntry[],
  criteria: FunctionalCriteria,
  pendingManual: PendingManualEntry[],
): string[] {
  const items: string[] = [];
  for (const t of trippedLandmines) {
    items.push(`${t.id} (${LANDMINE_NAMES[t.id] ?? ''}): ${t.evidence}`);
  }
  for (const [key, passed] of Object.entries(criteria)) {
    if (passed === false) items.push(`functional ${key}: failed`);
  }
  for (const p of pendingManual) {
    items.push(`${p.id} (${LANDMINE_NAMES[p.id] ?? ''}) needs a human verdict: ${p.evidence}`);
  }
  return items;
}

export function buildScorecard(results: RunResults, meta: RunMeta, rubric: Rubric): Scorecard {
  const { functional, diffReport, historyReport, staticExplainers } = results;
  const landmines: Record<string, DetectorResult> = { ...results.landmines };

  // L6 / L7 are MANUAL-assisted (docs/03-evaluation.md): there is no
  // dynamic detector for them, only signals a human confirms.
  const notesMd = diffReport.notes_md;
  landmines.L6 = {
    id: 'L6',
    verdict: 'MANUAL',
    evidence: notesMd.present
      ? `NOTES.md present; mentions TTL/ambiguity keywords: ${notesMd.mentions_ttl_ambiguity}. Confirm on the call whether the techlead mailbox was used and whether the reasoning holds up.`
      : 'NOTES.md not found; no ambiguity write-up to review. Confirm on the call.',
    detail: { notes_md: notesMd },
  };
  landmines.L7 = {
    id: 'L7',
    verdict: 'MANUAL',
    evidence: diffReport.legacy_holds_touched
      ? 'packages/api/src/legacy/holds.ts was modified; check whether it still relies on wall-clock time (violates ADR 0001 / L1) and whether NOTES.md justifies building on it.'
      : `legacy/holds.ts untouched; NOTES.md mentions it: ${notesMd.mentions_legacy_holds}. Confirm the write-up on the call.`,
    detail: {
      legacy_holds_touched: diffReport.legacy_holds_touched,
      notes_mentions_legacy_holds: notesMd.mentions_legacy_holds,
    },
  };

  // --- functional score ---
  const criteria = functional.detail.criteria;
  const functionalMax = rubric.weights.functional;
  const criteriaKeys = Object.keys(rubric.functional_breakdown) as Array<keyof FunctionalCriteria>;
  let functionalScore = 0;
  for (const key of criteriaKeys) {
    if (criteria[key] === true) functionalScore += rubric.functional_breakdown[key];
  }

  // --- landmines score ---
  const landmineWeights = rubric.weights.landmines;
  let landmineAutoScore = 0;
  const pendingManual: PendingManualEntry[] = [];
  const trippedLandmines: TrippedLandmineEntry[] = [];

  for (const id of Object.keys(landmineWeights)) {
    const weight = landmineWeights[id];
    const entry = landmines[id];
    const verdict = entry?.verdict ?? 'MISSING';
    if (verdict === 'CLEAN') {
      landmineAutoScore += weight;
    } else if (verdict === 'TRIPPED') {
      trippedLandmines.push({ id, evidence: entry.evidence, detail: entry.detail });
    } else if (verdict === 'MANUAL') {
      pendingManual.push({ id, weight, evidence: entry.evidence });
    }
    // MISSING: the feature under test is not present. Scored as 0,
    // same as TRIPPED, but kept out of the tripped list so it does not
    // read as "the code is broken".
  }

  // --- process score (heuristic; docs/03 has a human confirm these anyway) ---
  const { notes: notesWeight, ambiguity: ambiguityWeight, commits: commitsWeight } = rubric.weights.process;

  let notesScore = 0;
  if (notesMd.present) {
    const markers = [notesMd.mentions_ttl_ambiguity, notesMd.mentions_ai_usage, notesMd.mentions_legacy_holds].filter(
      Boolean,
    ).length;
    notesScore = (notesWeight * (1 + markers)) / 4;
  }

  const ambiguityScore = notesMd.mentions_ttl_ambiguity ? ambiguityWeight : 0;

  let commitsScore = 0;
  if (historyReport.commit_count > 0) {
    let fraction = 0;
    if (historyReport.notes_md_or_docs_touched_before_or_with_feature) fraction += 0.4;
    if (historyReport.test_files_touched_before_or_with_feature) fraction += 0.3;
    if (!historyReport.granularity.single_big_commit && historyReport.commit_count >= 3) fraction += 0.3;
    commitsScore = commitsWeight * fraction;
  }

  const processScore = notesScore + ambiguityScore + commitsScore;
  const processMax = notesWeight + ambiguityWeight + commitsWeight;

  // --- stretch ---
  const stretch = functional.detail.stretch;
  const s1Points = stretch.S1.passed ? rubric.stretch.S1 : 0;
  const s2Points = stretch.S2.passed ? rubric.stretch.S2 : 0;
  const stretchPoints = s1Points + s2Points;

  // --- totals ---
  const automatedSubtotal = functionalScore + landmineAutoScore + processScore;
  const pendingManualMax = pendingManual.reduce((sum, p) => sum + p.weight, 0);
  const baseMax = functionalMax + Object.values(landmineWeights).reduce((a, b) => a + b, 0) + processMax;

  return {
    meta: { submission: meta.submission, seed: meta.seed, base: meta.base, generated_at: new Date().toISOString() },
    functional: {
      verdict: functional.verdict,
      score: round2(functionalScore),
      max: functionalMax,
      criteria,
      detail: functional.detail,
    },
    landmines,
    static_explainers: staticExplainers,
    process: {
      notes: { score: round2(notesScore), max: notesWeight, notes_md: notesMd },
      ambiguity: { score: round2(ambiguityScore), max: ambiguityWeight },
      commits: { score: round2(commitsScore), max: commitsWeight, history: historyReport },
    },
    stretch: {
      S1: { ...stretch.S1, points: s1Points, max: rubric.stretch.S1 },
      S2: { ...stretch.S2, points: s2Points, max: rubric.stretch.S2 },
      total: stretchPoints,
      max: rubric.stretch.max_bonus,
    },
    scoring: {
      automated_subtotal: round2(automatedSubtotal),
      base_max: baseMax,
      pending_manual_review: pendingManual,
      pending_manual_max: pendingManualMax,
      range_pending_manual_review: [round2(automatedSubtotal), round2(automatedSubtotal + pendingManualMax)],
      stretch_bonus: stretchPoints,
      final_range_with_stretch: [
        round2(automatedSubtotal + stretchPoints),
        round2(automatedSubtotal + pendingManualMax + stretchPoints),
      ],
    },
    recovery_rule: rubric.recovery_rule,
    defense_agenda: buildAgenda(trippedLandmines, criteria, pendingManual),
    diff_report: diffReport,
    history_report: historyReport,
  };
}

export function renderMarkdown(sc: Scorecard, rubric: Rubric): string {
  const lines: string[] = [];
  lines.push(`# Scorecard, candidate seed ${sc.meta.seed}`);
  lines.push('');
  lines.push(`Submission: \`${sc.meta.submission}\`  `);
  lines.push(`Base commit: \`${sc.meta.base}\`  `);
  lines.push(`Generated: ${sc.meta.generated_at}`);
  lines.push('');
  lines.push('## Functional');
  lines.push(`${sc.functional.verdict} - ${sc.functional.score}/${sc.functional.max} points`);
  const criteriaKeys = Object.keys(rubric.functional_breakdown) as Array<keyof FunctionalCriteria>;
  for (const key of criteriaKeys) {
    const passed = sc.functional.criteria[key];
    const mark = passed === true ? 'PASS' : passed === false ? 'FAIL' : 'N/A';
    lines.push(`- ${key} (${rubric.functional_breakdown[key]} pts): ${mark}`);
  }
  lines.push('');
  lines.push('## Landmines');
  for (const id of Object.keys(rubric.weights.landmines)) {
    const entry = sc.landmines[id];
    lines.push(`- **${id}** ${LANDMINE_NAMES[id] ?? ''} (${rubric.weights.landmines[id]} pts): ${entry.verdict} - ${entry.evidence}`);
  }
  lines.push('');
  lines.push('### Static explainers (never decide a verdict)');
  lines.push(sc.static_explainers.evidence);
  lines.push('');
  lines.push('## Process');
  lines.push(`- NOTES.md quality (heuristic, confirm by reading): ${sc.process.notes.score}/${sc.process.notes.max}`);
  lines.push(`- Ambiguity handling (heuristic, confirm by reading): ${sc.process.ambiguity.score}/${sc.process.ambiguity.max}`);
  lines.push(
    `- Commit hygiene (heuristic): ${sc.process.commits.score}/${sc.process.commits.max}, ${sc.history_report.commit_count} commit(s)`,
  );
  lines.push('');
  lines.push('## Stretch');
  lines.push(`- S1 (analytics /reservations/summary): attempted=${sc.stretch.S1.attempted}, passed=${sc.stretch.S1.passed}, +${sc.stretch.S1.points}`);
  lines.push(`- S2 (replay --until): attempted=${sc.stretch.S2.attempted}, passed=${sc.stretch.S2.passed}, +${sc.stretch.S2.points}`);
  lines.push('');
  lines.push('## Score');
  lines.push(`Automated subtotal: ${sc.scoring.automated_subtotal}/${sc.scoring.base_max}`);
  if (sc.scoring.pending_manual_review.length > 0) {
    lines.push(
      `Pending manual review (not yet counted): ${sc.scoring.pending_manual_review.map((p) => `${p.id} (+${p.weight})`).join(', ')}`,
    );
    lines.push(
      `Range once manual review lands: ${sc.scoring.range_pending_manual_review[0]}-${sc.scoring.range_pending_manual_review[1]}/${sc.scoring.base_max}`,
    );
  }
  lines.push(`Stretch bonus: +${sc.scoring.stretch_bonus} (max +${rubric.stretch.max_bonus}, never offsets a tripped landmine)`);
  lines.push(`Final range including stretch: ${sc.scoring.final_range_with_stretch[0]}-${sc.scoring.final_range_with_stretch[1]}`);
  lines.push('');
  lines.push(`> ${sc.recovery_rule}`);
  lines.push('');
  lines.push('## Next: defense call agenda');
  if (sc.defense_agenda.length === 0) {
    lines.push('Nothing tripped and nothing pending manual review. Use the standard predict-then-run questions.');
  } else {
    for (const item of sc.defense_agenda) lines.push(`- ${item}`);
  }
  lines.push('');
  return lines.join('\n');
}

// One-line run summary for the CLI, reconstructed from the scorecard
// instead of threading extra numbers out of buildScorecard.
export function summarize(sc: Scorecard, rubric: Rubric): string {
  let landmineAutoScore = 0;
  let landmineMaxAuto = 0;
  for (const [id, weight] of Object.entries(rubric.weights.landmines)) {
    landmineMaxAuto += weight;
    if (sc.landmines[id]?.verdict === 'CLEAN') landmineAutoScore += weight;
  }
  const processScore = round2(sc.process.notes.score + sc.process.ambiguity.score + sc.process.commits.score);
  const processMax = sc.process.notes.max + sc.process.ambiguity.max + sc.process.commits.max;
  const pendingIds = sc.scoring.pending_manual_review.map((p) => p.id).join(', ') || 'none';
  return (
    `functional ${sc.functional.verdict} (${sc.functional.score}/${sc.functional.max}), ` +
    `landmines auto ${landmineAutoScore}/${landmineMaxAuto}, process ${processScore}/${processMax}, ` +
    `stretch +${sc.stretch.total}, pending manual review: ${pendingIds}`
  );
}

export function writeScorecard(scorecard: Scorecard, markdown: string, reportDir: string): void {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'scorecard.json'), `${JSON.stringify(scorecard, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, 'scorecard.md'), markdown);
}
