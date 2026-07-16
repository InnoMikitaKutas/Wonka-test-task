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
Verification completed with the following results:

- untouched fixture replay twice: `sha256:c61ab259e00b34a6335ce015eaf142ef134e4e904c4d6a86f311eb137965119a`;
- reservation-event replay twice: `sha256:86922afad3def89d8dbfb0afcfb6ada644230d6f5e9c35d6dbf4412f7403e325`;
- build, workspace typecheck, ESLint, Node tests, and Python pytest/ruff/mypy: green;
- analytics `/health`: `ignored_event_types` is empty after reservation events;
- forced projector redelivery: identical slot read-model checksum before and after;
- ten parallel reserves of one slot: exactly one `201` and nine `409` responses.
