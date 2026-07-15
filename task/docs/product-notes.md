# Product notes

Working notes from the product side. Not a spec; kept here so that engineering decisions have context.

## How recruiters use interview slots

- Recruiters open slots about a week ahead, usually in batches on Monday morning.
- Double-booking happens a few times every week and it is the most embarrassing failure we have: two candidates show up for the same slot.
- There are never enough slots: senior interviewers give us only 3-4 slots per week each.

## Holds (the hiring team's word for reservations)

- A "hold" means: a recruiter holds a slot for a candidate until the candidate confirms the time.
- Ops policy, agreed with the hiring team in Q3: **an unconfirmed hold expires after 12 hours.** Reasoning: there are not enough slots, and an unconfirmed hold blocks other candidates for too long.
- D. started implementing holds in the API before he left (see `packages/api/src/legacy/holds.ts`, behind a feature flag that was never enabled). His engine tests are still in the suite, currently skipped.

## Funnel facts

- Typical volume: 300-400 new applications per week; screening filters out about half.
- The weekly report for the hiring team is built from the analytics service. If a number in the report looks off, check its `/health` first: the service lists event types it does not recognize instead of silently guessing.
