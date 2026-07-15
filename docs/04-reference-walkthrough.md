# Reference walkthrough: how a strong candidate passes

*Reviewer-side document. It proves the task is doable by a human within the timebox, and it is used to calibrate the evaluator and to prepare interviewers.*

## Why this document exists

1. **Fairness proof.** Every landmine can be handled using only the information inside the repo.
2. **Evaluator calibration.** The reference solution defines the expected diff size, the expected hashes, and the "clean" baseline for the churn metrics.
3. **Interviewer preparation.** The "wrong move / right move" table below is where the defense call questions come from.

## Recommended route

### Phase 0: reconnaissance

1. `docker compose up -d`, `pnpm install && pnpm build`, `pnpm test`. Everything must be green before any change.
2. Read the four ADRs. They are short and they are the rules: time only from envelopes (0001), additive contracts (0002), legacy portal compatibility (0003), sequential projection (0004).
3. Run the replay CLI twice on the fixture log. Same hash both times. Now you know the baseline and you trust the tool.
4. Skim the fixture log: `head fixtures/events.jsonl`. Check the event types and the envelope fields. Note that every event carries `occurredAt`.
5. Find the skipped tests (`git grep -n "it.skip"`) and read them. They encode the expiry boundary rule: a reservation exactly at TTL counts as expired.
6. Read `docs/product-notes.md` and `packages/api/src/legacy/holds.ts`. Two things stand out: the notes say holds lapse after 12 hours while the assignment says 24, and the legacy module uses wall-clock time, which violates ADR 0001.
7. Write the assumption into `NOTES.md` immediately. Do not postpone it to the implementation phase.

### Phase 1: design

- New events, additive only: `ReservationPlaced`, `ReservationConfirmed`, `ReservationExpired` (v2 additions to the registry). No changes to any v1 schema.
- Expiry is **derived state**, not a timer. A pending reservation is expired when `occurredAt >= reservedAt + TTL`, where `occurredAt` comes from the incoming command's envelope. `ReservationExpired` events are emitted only by the sweep command, and the sweep's envelope carries the clock. No `Date.now()`, no timers, nothing non-deterministic in `engine` or `projector`.
- Slot rules live in the engine's `decide` function: reserving an actively held slot is rejected; confirming an expired reservation is rejected.
- Concurrency: reuse the append pattern from the existing handlers, `append(stream, events, expectedVersion)`, and map a version conflict to `409`. Never check-then-act over a read model.
- Analytics: register the three new event types in the Pydantic models so `/health` stays clean. The `/reservations/summary` endpoint is stretch goal S1, do it only if time remains.

### Phase 2: implementation order

`contracts` -> `engine` (plus unit tests, enable the skipped ones) -> `api` endpoints -> `projector` -> `analytics` -> `NOTES.md`.

The order matters: with contracts and engine done first, every later step can be checked against the replay CLI.

### Phase 3: verification

Checklist, mapped to the rules of the game:

- [ ] Replay of the untouched fixture log: hash unchanged (R2).
- [ ] Replay of fixture plus new events, run twice: identical hashes (R3).
- [ ] `git diff main -- fixtures/` is empty (R2); v1 schema files unchanged (R1).
- [ ] No new runtime dependencies, or a justification in `NOTES.md` (R4).
- [ ] The diff contains only files you meant to touch; no reformatting noise (R5).
- [ ] A quick parallel-reserve check of your own: two concurrent requests, one `201`, one `409` (criterion 5).
- [ ] All acceptance criteria pass locally, including the formerly skipped tests (criterion 8).
- [ ] `NOTES.md` has all five sections (R7).

## Landmine navigation table

| ID | Wrong move | Right move |
|----|-----------|------------|
| L1 | `Date.now()` or timers for expiry | Expiry derived from envelope timestamps; sweep emits the expiry events |
| L2 | Edit v1 schemas, regenerate fixtures | New v2 event types; fixtures untouched |
| L3 | Parallelize the projector loop (the TODO comment invites it) | Keep it sequential; if performance worries you, say so in NOTES |
| L4 | "Fix" string scores or 1-based stages | Leave them; ADR 0003 explains the legacy portal contract |
| L5 | Drive-by refactors, extra helper libraries | Surgical diff, standard library, justify anything extra |
| L6 | Silently pick 12 or 24 hours | Ask the techlead, or record the assumption and make TTL a config value |
| L7 | Build on `legacy/holds.ts` | Leave it untouched; note why its approach is not usable (wall-clock time) |
| L8 | Ship the Node changes only | Register the new events in the Pydantic models, check `/health`, run the pipeline end to end |
| L9 | Check the slot in a read model, then append (race window) | Append with an expected version, like every existing handler; map the conflict to `409` |