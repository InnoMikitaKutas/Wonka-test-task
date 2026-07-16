// Shared types for detectors, analysis, and the report renderer.

export type Verdict = 'CLEAN' | 'TRIPPED' | 'MANUAL' | 'MISSING';

// The one shape every detector produces. Detail is generic so a
// detector can hand render.ts a precisely typed payload instead of
// forcing every caller to re-narrow an unknown blob.
export interface DetectorResult<Detail = unknown> {
  id: string;
  verdict: Verdict;
  evidence: string;
  detail?: Detail;
}

// What a detector needs to reach the submission: HTTP endpoints, the
// replay CLI, the projections DB, and git. Never a path into the
// submission's own source modules.
export interface DetectorContext {
  submissionDir: string;
  baseRef: string;
  apiUrl: string;
  analyticsUrl: string;
}

export interface RubricWeights {
  functional: number;
  landmines: Record<string, number>;
  process: {
    notes: number;
    ambiguity: number;
    commits: number;
  };
}

export interface RubricStretch {
  S1: number;
  S2: number;
  max_bonus: number;
}

export interface Rubric {
  weights: RubricWeights;
  functional_breakdown: Record<string, number>;
  stretch: RubricStretch;
  recovery_rule: string;
  notes: string;
}
