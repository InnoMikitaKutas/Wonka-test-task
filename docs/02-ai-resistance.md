# Why this task resists AI: the landmine inventory

*Reviewer-side document. In real hiring use this file is private; a candidate sees only [01-assignment.md](01-assignment.md) and `task/`.*

## The honest premise

There is no isolated coding task that a modern agent cannot solve. This design starts from that fact instead of fighting it.

What agents reliably get wrong is narrower and more useful: **following many rules at once when those rules are spread across the codebase, while their statistical habits pull the other way**. The task is built so that every such failure leaves an objective, machine-checkable trace, and so that reasonable AI use (plan review, boilerplate, test scaffolding) still works fine. We are not filtering out AI. We are filtering out *unsupervised* AI.

## Four mechanisms that break agents

- **M1. Habits beat instructions.** Models carry strong training-data habits: `Date.now()` for anything related to expiry, `Promise.all` for any loop, editing a schema in place when a new field is needed, `npm install` when a utility is missing. A rule written far from the edit site loses to the habit at the edit site.
- **M2. Constraint decay.** In long agent sessions, context gets compacted and files get read partially. Rules that live in different places (an ADR here, a fixture there, a test somewhere else) fall out first, and *negative* rules ("do not touch X") decay faster than positive ones.
- **M3. Visible-green optimization.** Agents optimize the tests they can see. The evaluator (detectors, per-seed golden hashes, delivery-order tests) is hidden, so there is nothing to overfit to. The rules are declared openly in the assignment; the measurement is not.
- **M4. No instinct to stop and ask.** Faced with a contradiction in the spec, an agent silently picks one reading and moves on. A production engineer notices it, asks, or records the decision. The assignment plants exactly one such contradiction and provides a real channel to ask.

## Landmine inventory

Each landmine is a real production rule: documented inside the repo, discoverable by reading, and broken by current agents out of habit. Nothing depends on trick knowledge.

| ID | Rule | AI habit it exploits | Planted where | Detected by |
|----|-----------|---------------------|---------------|-------------|
| L1 | Replay determinism: time enters only via envelopes | `Date.now()` / timers in expiry logic | ADR 0001; the feature itself is about time | Double-replay hash compare; grep in `engine`/`projector` |
| L2 | History immutable; contracts additive-only | Edit the v1 schema in place; regenerate fixtures | ADR 0002; pinned golden hash; `fixtures/` | Old-log hash vs per-seed pin; `git diff fixtures/`; schema snapshot |
| L3 | Per-aggregate ordering and idempotency in the projector (delivery is at-least-once) | "Optimize" the sequential loop with `Promise.all`; insert instead of upsert | ADR 0004; a bait `// TODO(perf)` comment in the loop | Interleaved and duplicated delivery test; grep |
| L4 | Legacy compatibility that looks wrong but is right | "Fix" what looks broken | Scores are decimal *strings*; stages are *1-based*; ADR 0003 (legacy PHP portal) | Golden tests on API responses and hash |
| L5 | Scope discipline | Drive-by refactors, reformatting, new dependencies | Rules R4-R5 in the assignment | Diff-path allowlist; lockfile diff; churn stats |
| L6 | Handle ambiguity like in production | Silently pick one reading | Assignment says 24h TTL; `task/docs/product-notes.md` says the ops policy is 12h; the legacy module says `TTL_HOURS = 12` | Techlead mailbox log; `NOTES.md` assumptions |
| L7 | Judgment on inherited half-finished work | Build on whatever already exists | `packages/api/src/legacy/holds.ts`: a departed developer's wall-clock draft, behind a disabled flag; his `it.skip` tests encode the true boundary rule | Diff on the module; NOTES justification; whether L1 fired |
| L8 | Cross-language contract sync | Forget the neighboring service in another language | `services/analytics` mirrors the contracts in Pydantic *by hand* (stated in its README) | Pipeline run with the candidate's v2 events, then analytics `/health` and funnel correctness; TS vs Pydantic registry diff |
| L9 | Reservation writes are race-safe (optimistic concurrency on append) | Check-then-act over a stale read | The feature demands it; every existing command handler uses `append(stream, events, expectedVersion)` | Parallel-reserve test; grep for appends without an expected version |

### Details on the most important ones

**L1 (determinism)** is the anchor. The feature is deliberately time-shaped: "expires after 24 hours" pulls almost every model toward `setTimeout` or `Date.now()`, because that is the dominant pattern in training data. The correct design (expiry as state derived from event timestamps; `ReservationExpired` emitted only by the sweep command, whose envelope carries the clock) is fully documented in ADR 0001 and used consistently by all existing code. A person who has read the engine sees it immediately. An agent that read it early in the session has often lost it by the time it writes the reservation logic (M2).

**L6 (ambiguity)** is the cheapest to handle and the most telling. The assignment's 24 hours stands against two in-repo sources that say 12. One short email, or one honest line in NOTES.md, closes it. This is a direct work sample of a requirement most job descriptions state and never test: good decisions under an unclear spec. No agent will send that email on its own.

**L7 (the decoy)** tests exactly the failure this brief worries about: AI doing *too much*. The half-finished `holds.ts` looks like a head start: types, a flag, a TODO list. It is also built on wall-clock time, so extending it breaks L1. The right move is a two-line NOTES entry: "read legacy/holds.ts; its approach violates ADR 0001; left untouched, proposed for deletion". The skipped tests left by the same developer (boundary rule: a reservation exactly at TTL counts as expired) are the reward for actually reading his work; acceptance criterion 8 requires enabling them.

**L8 (drift)** is the most true to life: the candidate ships perfect Node code and forgets that a Python service in the same repo consumes the same events. Analytics has a documented policy for unknown events (count them in `/health` as `ignored_event_types`, never distort the metrics silently). The required work is tiny on purpose: register the new event types in the Pydantic registry so `/health` stays clean. Missing a five-line change that the assignment asks for explicitly reads as exactly one thing: nobody checked the neighbor service. The bigger piece of Python work, the `/reservations/summary` endpoint, is stretch goal S1.

**L9 (race-safe writes)** is the only landmine that lives inside the feature instead of around it. "Check if the slot is free, then append" passes every sequential test and fails under two parallel requests. The correct pattern is visible in every existing command handler: `append(stream, events, expectedVersion)`, with a `409` on version conflict. Agents reproduce the check-then-act shape constantly, because most training examples are written against databases with implicit transactions, not against event logs.

## Fairness principles

1. **Everything is discoverable.** Every landmine has a paper trail inside the repo: an ADR, a product note, existing code that follows the rule, or a test. A trap that needs outside knowledge would be trivia, not assessment.
2. **Every landmine is real.** Each one maps to a known production incident class: broken replay, corrupted history, out-of-order projections, precision loss, PR scope creep, contract drift between services. Nothing is planted that would not belong in a real codebase of this shape.
3. **A trip is an agenda item, not a rejection.** Every fired detector becomes a question on the defense call, and a candidate who explains their own miss recovers most of the points ([03-evaluation.md](03-evaluation.md)). We measure the mental model, and a sharp post-mortem is evidence of one.
4. **Passable by a human in the timebox.** The reference walkthrough ([04-reference-walkthrough.md](04-reference-walkthrough.md)) navigates all nine landmines within 4-6 hours, reading included. The stretch goals exist to widen the top of the scale, not to inflate the core.