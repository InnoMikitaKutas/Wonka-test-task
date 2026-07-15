# Take-home assignment: interview slot reservations

*Candidate-side document. Reviewer-side material lives in [02-ai-resistance.md](02-ai-resistance.md) and [03-evaluation.md](03-evaluation.md).*

---

The `task/` directory contains a small applicant tracking system (ATS). Recruiters move candidates through a pipeline (`applied -> screening -> interview -> offer -> hired`). Every change is stored as an immutable event, and read models are built from the event log.

Your task is to implement one feature, **interview slot reservations with auto-expiry**, end to end: new events in `contracts`, domain logic in `engine`, endpoints in `api`, read models in `projector`, and keeping the `analytics` service aware of the new events. The feature is described in detail below; the rules of this codebase apply to every step.

**Timebox:** You have 3 calendar days from receiving the repo, so you can spread those hours around your schedule. We prefer a smaller, solid submission over a big rushed one.

## The system

```
task/
├── packages/
│   ├── contracts/    # event & command schemas (zod) + event registry, the shared language
│   ├── engine/       # pure domain logic: decide/reduce functions. No I/O, no framework.
│   ├── api/          # NestJS REST API: commands in, events appended
│   └── projector/    # consumes the event log, maintains read models in PostgreSQL
├── services/
│   └── analytics/    # FastAPI service: funnel and timing metrics read from projections
├── tools/
│   └── replay/       # CLI: replays an event log through the engine, prints a state hash
├── fixtures/
│   └── events.jsonl  # ~10k historical production events (v1)
└── docs/
    ├── adr/          # architecture decision records: the rules of this codebase
    └── product-notes.md
```

Getting started:

```bash
cd task
docker compose up -d        # PostgreSQL
pnpm install && pnpm build
pnpm test                   # green on a fresh clone
pnpm replay -- --file fixtures/events.jsonl   # prints: state=sha256:<...>
```

**Start by reading `docs/adr/`.** The four ADRs are short and they are the ground rules here. The replay CLI is your friend: the event log is the source of truth, and the state hash is how we know two runs agree.

## The feature

Recruiters keep double-booking interview slots. Product wants reservations with auto-expiry:

- A recruiter **reserves** an interview slot for a candidate. The reservation starts as `pending`.
- A pending reservation **expires after 24 hours** if not confirmed, and the slot becomes free again.
- A recruiter can **confirm** a pending reservation before it expires. A confirmed reservation holds the slot until the interview.
- A slot with an active reservation (pending and not expired, or confirmed) **cannot be reserved again**.

### Acceptance criteria

1. `POST /candidates/:candidateId/reservations` with `{ "slotId": "..." }` returns `201 { reservationId, status: "pending", expiresAt }`. Reserving a slot that is actively held returns `409`.
2. `POST /reservations/:reservationId/confirm` returns `200 { status: "confirmed" }` for a pending, unexpired reservation, and `410` if it has expired.
3. `POST /admin/sweep` expires all overdue pending reservations and returns `{ "expired": <count> }`. (In production this would run on a schedule; here it is an endpoint.)
4. A slot released by expiry can be reserved again.
5. **Concurrency:** when two parallel requests try to reserve the same slot, exactly one wins: one gets `201`, the other gets `409`. This must hold under truly parallel requests, not only sequential ones.
6. After your new events flow through the system, `GET /health` on the **analytics service** must not list them in `ignored_event_types`, and the existing funnel metrics must stay correct.
7. `pnpm replay` over any log (the historical fixture, or fixture plus your new events) is **deterministic**: same log in, same state hash out, every time.
8. The full existing test suite passes, **including the tests that are currently skipped**.

The REST and CLI contract above is fixed, because our tooling depends on it. Everything behind it (event design, module layout, table shapes) is your decision.

### Stretch goals (optional)

- **S1.** `GET /reservations/summary` on the analytics service: returns `{ "pending": n, "confirmed": n, "expired": n }` and stays consistent with the event log.
- **S2.** `pnpm replay --until <ISO timestamp>`: replay only the events up to that moment and print the state hash of that point in time.

## Rules

These are real constraints of this codebase, not ceremony. Each one has an ADR or a product note behind it.

- **R1. Contracts are additive-only.** `packages/contracts` may gain new event types and optional fields. Existing v1 event schemas must not change shape or meaning. (`docs/adr/0002`)
- **R2. History is immutable.** `fixtures/events.jsonl` must not be modified or regenerated. Replaying the untouched historical log must produce the same state hash as before your change.
- **R3. The engine is deterministic.** No wall-clock reads, no randomness, no I/O inside `engine` or `projector` logic. Time enters the system only through command and event envelopes. (`docs/adr/0001`)
- **R4. No new runtime dependencies** without a written justification in `NOTES.md`.
- **R5. Keep the diff surgical.** Do not reformat, restyle, or refactor code you do not need to touch. We read diffs, not snapshots.
- **R6. When the spec is unclear, act like it is production.** Ask us (contact below), or make a decision and record it in `NOTES.md`. Silent guessing is the only wrong option.

## Submitting

- Work in a git repo with incremental commits. We read the history, not only the final state.
- Submit repo access plus `NOTES.md`.
- After submission there is a **45-minute defense call**: you walk us through your solution, we ask questions and run things together.