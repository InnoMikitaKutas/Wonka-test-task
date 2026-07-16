import type { CandidateReadModelEntity } from '@ats/persistence';

// Shape returned to callers. Stage stays a 1-based int and score stays
// a string (or null), never converted, per ADR 0003.
export interface CandidateView {
  id: string;
  name: string | null;
  position: string | null;
  source: string | null;
  stage: number;
  score: string | null;
  offerNote: string | null;
  updatedAt: string | null;
}

export function toCandidateView(entity: CandidateReadModelEntity): CandidateView {
  return {
    id: entity.id,
    name: entity.name,
    position: entity.position,
    source: entity.source,
    stage: entity.stage,
    score: entity.score,
    offerNote: entity.offerNote,
    updatedAt: entity.updatedAt ? entity.updatedAt.toISOString() : null,
  };
}
