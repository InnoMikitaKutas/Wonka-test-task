# Implementation notes

## Assumptions and ambiguity

The assignment fixes the externally observable reservation TTL at **24 hours**, while
`docs/product-notes.md` records an older 12-hour ops policy. I could not contact a
tech lead from this isolated take-home environment, so I used the assignment's fixed
REST contract as the current requirement and made the TTL an explicit engine constant.
This is the one decision I would confirm with the tech lead before production rollout.
The expiry boundary is inclusive: at `occurredAt >= expiresAt`, a pending reservation
is expired.

## Design

Reservation events are additive contracts. Expiry is derived only from command/event
envelope timestamps; an explicit sweep emits expiry events. Slot streams are the
optimistic-concurrency boundary, so concurrent reservations of one slot race on one
expected stream version. Projection remains sequential and every update is idempotent.

## Legacy code

I read `packages/api/src/legacy/holds.ts` and deliberately left it untouched. Its
`Date.now()` approach violates ADR 0001 and would make replay-dependent behavior
non-deterministic. It should be deleted separately after confirming no disabled-flag
consumer remains.

## Scope and dependencies

The implementation is limited to contracts, engine, API, projector, analytics, tests,
and this note. It adds no runtime dependency and does not modify historical fixtures,
v1 behavior, legacy stage indexes, or decimal-string scores.

## Verification and AI usage

I used an AI coding agent for repository reconnaissance, implementation, and test
iteration, and reviewed every resulting diff against the ADRs and acceptance criteria.
The final verification record will include the historical replay hash, deterministic
extended replay, build/typecheck/lint/tests, analytics health, projector redelivery,
and a real parallel-reservation probe.
