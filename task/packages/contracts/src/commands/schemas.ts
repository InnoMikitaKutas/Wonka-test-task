// Command payloads for the v1 surface.
// Entity ids are generated at the API edge and passed in. The engine
// never generates ids, so replaying decisions stays deterministic.
// See docs/adr/0001.
import { z } from 'zod';
import { scoreString, stageIndex } from '../events/primitives';

export const SubmitApplicationPayload = z.object({
  candidateId: z.string(),
  name: z.string(),
  position: z.string(),
  source: z.string(),
});

export const ChangeStagePayload = z.object({
  candidateId: z.string(),
  toStage: stageIndex,
});

export const AssignScorePayload = z.object({
  candidateId: z.string(),
  score: scoreString,
  assessor: z.string(),
});

export const ExtendOfferPayload = z.object({
  candidateId: z.string(),
  note: z.string(),
});

export const OpenSlotPayload = z.object({
  slotId: z.string(),
  interviewer: z.string(),
  startsAt: z.string().datetime(),
});

export const ScheduleInterviewPayload = z.object({
  slotId: z.string(),
  candidateId: z.string(),
});
