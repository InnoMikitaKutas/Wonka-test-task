import type { SlotReadModelEntity } from '@ats/persistence';

export interface SlotView {
  id: string;
  interviewer: string | null;
  startsAt: string | null;
  scheduledCandidateId: string | null;
}

export function toSlotView(entity: SlotReadModelEntity): SlotView {
  return {
    id: entity.id,
    interviewer: entity.interviewer,
    startsAt: entity.startsAt ? entity.startsAt.toISOString() : null,
    scheduledCandidateId: entity.scheduledCandidate,
  };
}
