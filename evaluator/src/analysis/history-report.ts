// Stage 3: shape of the submission's git history. Commit count,
// granularity, and a heuristic for whether reading/tests came before
// feature work (docs/03-evaluation.md: "was there reading and testing
// before feature commits"). All from `git log`, nothing else.

import { git } from '../lib/exec.js';

const UNIT = ''; // unlikely to appear in a commit subject line
const RECORD = ''; // unlikely to appear in a commit subject line

const FEATURE_FILE_RE = /^(packages\/(contracts|engine|api|projector)\/src\/|services\/analytics\/app\/)/;
const TEST_FILE_RE = /(^|\/)(test|tests)\/|\.(spec|test)\.(ts|py)$/;
const DOCS_OR_NOTES_RE = /^(NOTES\.md$|docs\/)/;

interface CommitInfo {
  sha: string;
  subject: string;
  files: string[];
  touches_feature_code: boolean;
  touches_tests: boolean;
  touches_notes_or_docs: boolean;
}

export interface CommitSummary {
  sha: string;
  subject: string;
  files_changed: number;
}

export interface HistoryReport {
  base: string;
  commit_count: number;
  commits: CommitSummary[];
  notes_md_or_docs_touched_before_or_with_feature: boolean;
  test_files_touched_before_or_with_feature: boolean;
  granularity: {
    avg_files_per_commit: number;
    max_files_in_one_commit: number;
    single_big_commit: boolean;
  };
}

export async function buildHistoryReport(submissionDir: string, baseRef: string): Promise<HistoryReport> {
  const raw = (
    await git(['log', '--reverse', `--pretty=format:${RECORD}%H${UNIT}%s`, '--name-only', `${baseRef}..HEAD`], submissionDir)
  ).stdout;

  const commits: CommitInfo[] = [];
  const blocks = raw.split(RECORD).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const lines = block.split('\n');
    const [sha, subject] = lines[0].split(UNIT);
    const files = lines
      .slice(1)
      .map((l) => l.trim())
      .filter(Boolean);
    commits.push({
      sha,
      subject,
      files,
      touches_feature_code: files.some((f) => FEATURE_FILE_RE.test(f)),
      touches_tests: files.some((f) => TEST_FILE_RE.test(f)),
      touches_notes_or_docs: files.some((f) => DOCS_OR_NOTES_RE.test(f)),
    });
  }

  const commitCount = commits.length;
  const firstFeatureIndex = commits.findIndex((c) => c.touches_feature_code);
  const firstDocsOrNotesIndex = commits.findIndex((c) => c.touches_notes_or_docs);
  const firstTestIndex = commits.findIndex((c) => c.touches_tests);

  // "Reading first": either no feature commit exists yet, or a
  // docs/NOTES commit shows up at or before the first feature commit.
  const readingFirst =
    firstFeatureIndex === -1 || (firstDocsOrNotesIndex !== -1 && firstDocsOrNotesIndex <= firstFeatureIndex);
  // "Tests alongside or before the feature": a test-touching commit at
  // or within one commit of the first feature commit, not bolted on at
  // the very end.
  const testsAlongsideOrBeforeFeature =
    firstFeatureIndex === -1 || (firstTestIndex !== -1 && firstTestIndex <= firstFeatureIndex + 1);

  const filesPerCommit = commits.map((c) => c.files.length);
  const totalFiles = filesPerCommit.reduce((a, b) => a + b, 0);
  const avgFilesPerCommit = commitCount > 0 ? totalFiles / commitCount : 0;
  const maxFilesInOneCommit = filesPerCommit.length > 0 ? Math.max(...filesPerCommit) : 0;
  const singleBigCommit = commitCount === 1 && maxFilesInOneCommit > 5;

  return {
    base: baseRef,
    commit_count: commitCount,
    commits: commits.map((c) => ({ sha: c.sha.slice(0, 10), subject: c.subject, files_changed: c.files.length })),
    notes_md_or_docs_touched_before_or_with_feature: readingFirst,
    test_files_touched_before_or_with_feature: testsAlongsideOrBeforeFeature,
    granularity: {
      avg_files_per_commit: Number(avgFilesPerCommit.toFixed(2)),
      max_files_in_one_commit: maxFilesInOneCommit,
      single_big_commit: singleBigCommit,
    },
  };
}
