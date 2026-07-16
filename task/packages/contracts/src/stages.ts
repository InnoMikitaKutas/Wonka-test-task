// Stage indexes are 1-based in every API response and event payload,
// see docs/adr/0003; index 0 is never used. The legacy HR portal treats
// stage 0 as "missing".
export const STAGES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
] as const;

export type StageName = (typeof STAGES)[number];

export const STAGE_COUNT = 5;
