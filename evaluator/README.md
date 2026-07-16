# evaluator

Private, reviewer-side scoring harness for a candidate submission of
the ATS take-home assignment. See `docs/03-evaluation.md` for the full
design (the four stages, the scorecard shape, the rubric weights, the
recovery rule), `docs/02-ai-resistance.md` for what each landmine
detects and why, and `docs/01-assignment.md` for the assignment the
candidate actually saw.

**Privacy note.** This package is private. In real hiring use, a
candidate never sees this directory or `docs/02-ai-resistance.md` /
`docs/03-evaluation.md`, only `docs/01-assignment.md` and `task/`. Do
not share `evaluator/` with a candidate.

## Requirements

- `node` >= 20 (global `fetch`, no extra HTTP client needed)
- `pnpm`
- `git`
- `docker` with `docker compose` - the submission's own postgres.
  Detectors reach the database through `docker compose exec postgres
  psql`, so no local `psql` client install is required.
- `uv` - starts the submission's analytics service for a fresh Stage 0
  run (not needed with `--reuse-db`)

This package is a standalone TypeScript project, outside `task/`'s
pnpm workspace. It has its own `node_modules`.

## Setup

```bash
cd evaluator
pnpm install
```

## Running it

```bash
pnpm run run -- --submission ../candidate-repo --seed 7f3a91
```

(pnpm requires the script name after `run`; since the script itself is
also named `run`, it appears twice. `pnpm exec tsx src/run.ts
--submission ../candidate-repo --seed 7f3a91` works too.)

Flags:

- `--submission <dir>` (required): a candidate's copy of `task/`, a git
  repo whose first commit is the untouched initial state.
- `--seed <seed>` (default `wonka-demo-001`): recorded in the scorecard
  header as metadata. Fixtures are already seeded per candidate before
  this runs; this flag does not regenerate anything (never regenerate
  fixtures, see `seeds/README.md`).
- `--reuse-db` (flag): skip Stage 0 setup and assume `docker compose`,
  migrations, seeding, and the api/analytics services are already
  running. Reads `API_URL`, `ANALYTICS_URL`, `DATABASE_URL` from the
  environment (sensible localhost defaults if unset). Postgres and any
  externally-started services are never stopped at the end when this
  flag is used.
- `--base <ref>` (default: the submission's first commit, via
  `git rev-list --max-parents=0 HEAD`): the commit every git-based
  detector diffs against.

Stage 0, when not skipped, builds and starts the submission with its
current commands: `pnpm install`, `pnpm -r build` (compiles the api
through Nest, since the api must run from `dist`, never through
`tsx`), `docker compose up -d`, `pnpm db:migrate`, `pnpm db:seed`,
`pnpm --filter @ats/projector project`, then `node
packages/api/dist/main.js` for the api and `uv run uvicorn
app.main:app` for analytics.

Output: `evaluator/report/scorecard.json` and
`evaluator/report/scorecard.md`, overwritten on every run. Service
startup logs for one run live under
`evaluator/report/work/run.<id>/` for debugging; nothing there is
required reading, the scorecard is the deliverable.

## Design

- **Black box first.** Every dynamic detector talks to the submission
  only through HTTP (the api and analytics services), the replay CLI,
  the projections database (via `docker compose exec postgres psql`),
  and git. None of them import the submission's internal modules, so a
  candidate's refactor cannot break the harness.
- **Static greps are explainers, never verdicts.**
  `detectors/static-greps.ts` always reports `MANUAL`; it exists only
  to point at a line for the defense call when a dynamic detector (L1,
  L3, L9) trips.
- **A detector never crashes the run.** `run.ts` calls every detector
  in a try/catch; a thrown error becomes a `MISSING` verdict with a
  note in the console log, not a stopped pipeline.
- **L6 and L7 are MANUAL-assisted.** There is no dynamic detector file
  for them (see the tree below: only L1, L2, L3, L4, L5, L8, L9 have
  one). `report/render.ts` collects what signals it can from
  `analysis/diff-report.ts` (whether `NOTES.md` mentions the TTL
  ambiguity or `legacy/holds.ts`, whether `legacy/holds.ts` was
  touched) and always reports both as `MANUAL`. A human reads
  `NOTES.md` and the diff to confirm the actual verdict, and separately
  confirms whether the techlead mailbox was used, which the evaluator
  has no way to see at all.
- **Process scoring is a heuristic.** NOTES.md quality, ambiguity
  handling, and commit hygiene are keyword- and shape-based proxies,
  not a real quality judgement. `docs/03-evaluation.md` already expects
  a human to read `NOTES.md` and the commit history as part of Stage 2
  review; treat these numbers as a starting point for that reading, not
  a final answer.
- **Recovery rule.** The scorecard is the agenda for the defense call,
  not the final grade: a tripped landmine that the candidate explains
  well on the call recovers up to 60% of its weight. See the
  `recovery_rule` field in `rubric.config.json` and
  `docs/03-evaluation.md`. The automated scorecard never applies this
  rule itself, since it requires the actual conversation.

## Tree

```
evaluator/
├── package.json               @ats/evaluator, standalone TS project
├── tsconfig.json               strict, nodenext
├── eslint.config.mjs           typescript-eslint recommended, no-explicit-any
├── rubric.config.json          weights, functional breakdown, recovery rule
├── src/
│   ├── run.ts                 entry point, the four stages
│   ├── config.ts               resolved paths, API/ANALYTICS/DATABASE URLs
│   ├── lib/
│   │   ├── exec.ts             child_process wrappers: exec, git, psql, spawnLogged
│   │   ├── http.ts             fetch wrappers: getJson/postJson, probe, looksLikeMissingRoute
│   │   ├── hash.ts             sha256
│   │   ├── replay.ts           shared replay-CLI-and-parse-hash helper
│   │   ├── pnpm-lock.ts         shared pnpm-lock.yaml runtime-deps reader
│   │   └── types.ts            DetectorResult, DetectorContext, Rubric
│   ├── detectors/
│   │   ├── functional.ts       Stage 1: acceptance criteria 1-8 + stretch S1/S2
│   │   ├── l1-determinism.ts   double replay, compare hashes
│   │   ├── l2-immutability.ts  fixtures/v1-schema diff + replay-vs-pin
│   │   ├── l3-ordering.ts      forced projector redelivery, idempotency
│   │   ├── l4-golden.ts        1-based stage, string score, golden hash
│   │   ├── l5-scope.ts         diff-path allowlist, lockfile diff, churn
│   │   ├── l8-drift.ts         analytics /health + /funnel consistency
│   │   ├── l9-concurrency.ts   N=10 parallel reserve, exactly one 201
│   │   ├── static-greps.ts     explainer greps only, always MANUAL
│   │   └── index.ts            detector list
│   ├── analysis/
│   │   ├── diff-report.ts      scope/churn/deps + NOTES.md signals, structured
│   │   └── history-report.ts   commit shape, reading/tests-before-feature heuristic
│   └── report/
│       └── render.ts           computes the score, writes scorecard.json/.md
├── seeds/                      fixture generator + per-candidate pins (not touched here)
└── report/
    ├── scorecard.json          generated
    ├── scorecard.md            generated
    └── work/                   per-run service logs
```
