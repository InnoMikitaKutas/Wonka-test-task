# How submissions are verified

*Reviewer-side document. Covers the automated evaluator, the scoring rubric, and the defense call. The `evaluator/` package implements what is specified here.*

## Overview: three layers

1. **Automated evaluator.** Functional acceptance, landmine detectors, diff and history analysis. Produces a structured scorecard.
2. **Human review.** Reads the scorecard, the diff, `NOTES.md` and the commit history. Confirms the semi-automatic signals (L6, L7).
3. **Defense call (45 minutes).** Measures the mental model directly. The scorecard is the agenda of the call, not its verdict: every tripped landmine becomes a question, and a good explanation wins points back.

The evaluator never outputs hire or no-hire. It turns a submission into evidence.

## The evaluator package

```
evaluator/
├── run.sh                       # entry point
├── detectors/
│   ├── functional.spec.ts       # Stage 1: black-box acceptance criteria 1-8 + stretch checks
│   ├── l1-determinism.sh        # replay twice, compare hashes
│   ├── l2-immutability.sh       # old-log hash vs pin; fixtures and v1-schema diff
│   ├── l3-ordering.spec.ts      # interleaved and duplicated delivery
│   ├── l4-golden.spec.ts        # score-as-string and 1-based stages preserved
│   ├── l5-scope.sh              # diff-path allowlist, lockfile diff, churn stats
│   ├── l8-drift.spec.ts         # v2 events through the pipeline, analytics health and funnel
│   ├── l9-concurrency.spec.ts   # parallel reserve requests: exactly one 201, one 409
│   └── static-greps.sh          # Date.now/Math.random in engine; Promise.all in projector;
│                                # appends without an expected version
├── analysis/
│   ├── diff-report.ts           # scope, churn, dependency changes
│   └── history-report.ts        # commit granularity and order
├── seeds/                       # fixture generator + per-candidate expected hashes
├── rubric.config.json           # weights; calibration lives in config, not code
└── report/                      # renders scorecard.json / scorecard.md
```

Invocation:

```bash
./evaluator/run.sh --submission ../candidate-repo --seed 7f3a91
```

**Design rule: black box first.** Dynamic detectors touch the submission only through the surfaces fixed in the assignment: HTTP endpoints, the replay CLI, the projections database, git. The candidate can structure the internals in any way; a refactor cannot break the evaluator. Static greps exist only as explainers: when a dynamic test fails, the grep points at the exact line to discuss on the call. This is also why the assignment pins the REST and CLI contract: a fixed contract is what makes honest black-box grading possible.

## The four stages

**Stage 0: setup.** Fresh clone, `docker compose up`, `pnpm install && pnpm build`, migrations. The project must come up with the documented commands. A failure here is recorded with high severity, but grading continues where possible: a broken dev setup is a call topic, not an instant fail.

**Stage 1: functional acceptance.** Hidden black-box tests for acceptance criteria 1-8: reserve, conflict, confirm, sweep, release semantics, the parallel-reserve race, analytics health, replay determinism, and the full suite green including the formerly skipped tests. This gate exists so that avoiding every trap while not shipping the feature scores what it should. Stretch goals S1 and S2, when present, run through their own checks and add bonus points; skipping them is never penalized.

**Stage 2: landmine detectors.** Each detector emits `CLEAN`, `TRIPPED` or `MANUAL`, with attached evidence (test output, hash pair, diff excerpt, grep hit). L6 and L7 are `MANUAL`-assisted: the script collects the signals (was the techlead mailbox contacted; does `NOTES.md` cover the TTL conflict and the legacy module; was `legacy/holds.ts` modified) and a human confirms the verdict.

**Stage 3: diff and history analysis, then report.** Diff scope against the allowlist, lockfile changes, churn ratio (lines changed vs the reference-solution baseline), commit history shape (was there reading and testing before feature commits). Everything renders into `scorecard.json` and `scorecard.md`.

### Example scorecard (abridged)

```markdown
# Scorecard, candidate seed 7f3a91
Functional   9/12 acceptance checks passed (sweep idempotency failing, evidence attached)
Landmines    L1 CLEAN   L2 CLEAN   L3 TRIPPED  Promise.all at projector/src/consume.ts:41;
                                               ordering test diverged (expected/actual attached)
             L4 CLEAN   L5 WARN    new runtime dep "dayjs", justified in NOTES, manual review
             L6 CLEAN   asked the techlead about 12h vs 24h on day 1 (mailbox log)
             L7 CLEAN   holds.ts untouched, NOTES explains why
             L8 TRIPPED analytics /health lists ReservationPlaced in ignored_event_types;
                        v2 events missing from the Pydantic registry (registry diff attached)
             L9 CLEAN   expected-version append, parallel test passes
Stretch      S1 implemented, checks pass (+4); S2 not attempted
Process      NOTES.md complete; AI usage disclosed (Claude Code: plan + projector scaffold);
             11 commits, incremental, reading-first
Next:        defense agenda -> consume.ts:41, analytics/models.py, dayjs, sweep idempotency
```

## Scoring rubric

Weights live in `rubric.config.json` and get calibrated over time; the table below is the starting point.

| Block | Weight | Breakdown |
|-------|--------|-----------|
| Functional | 40 | acceptance criteria, weighted toward 1-5 (core semantics and concurrency) and 7 (determinism) |
| Landmines | 40 | L1: 7, L2: 5, L3: 5, L4: 4, L5: 4, L6: 4, L7: 3, L8: 4, L9: 4 |
| Process | 20 | NOTES quality: 8, ambiguity handling: 6, commit hygiene: 6 |

**Stretch goals** add up to 8 bonus points on top of the base score (S1: 4, S2: 4). Bonus never offsets tripped landmines: depth does not buy back discipline.

**Recovery rule.** On the defense call, a candidate who correctly explains a tripped landmine (what broke, why, and what the fix is) recovers up to 60% of its weight. A candidate who defends the broken code, or cannot read it, recovers nothing. This turns a "gotcha" into a second chance and keeps the assessment centered on understanding rather than on one bad afternoon.

**AI disclosure is never penalized.** "The agent wrote the projector scaffold; I caught it using `Promise.all` and reverted it" is one of the strongest possible signals. It is the day-job skill in a small form.

## Defense call: 45 minutes

| Time | Segment | What it measures |
|------|---------|------------------|
| 0-5 | The candidate walks through the solution, repo on screen | Can they narrate their own design? |
| 5-15 | **Predict-then-run**, 2-3 rounds: the candidate states the expected output *before* we execute | The mental model, directly |
| 15-30 | **Line-pointing**: 3-4 prepared spots from the scorecard agenda, plus one **false-bug probe** on correct code ("this looks broken to me, is it?") | Do they own the diff? Will they defend correct code under pressure? That is the exact skill of reviewing AI output |
| 30-40 | **"What breaks if..."** probes, plus a conversation about their AI usage (showing prompts is welcome) | Depth beyond the diff; supervision skill |
| 40-45 | The candidate's questions | Signal in both directions |

Predict-then-run question bank (examples):

- "We replay the untouched historical log on your branch. What hash comes out, and why are you sure?"
- "The projector receives your `ReservationConfirmed` event twice. What does `/reservations/summary` show?"
- "We call `/admin/sweep` twice in a row. What does the second call return?"
- "Two parallel requests reserve the same slot. Walk me through what each one returns."

Interviewers fill a structured form per segment, using the same rubric IDs, instead of free-form impressions. Assessments should be comparable across candidates and across interviewers.