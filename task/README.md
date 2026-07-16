# ATS monorepo

A small applicant tracking system (ATS). Recruiters move candidates through a
pipeline (`applied -> screening -> interview -> offer -> hired`). Every change is
stored as an immutable event, and the read models are built from the event log.

This README is about running the repo and finding your way around it. The feature
you build and the acceptance criteria are in the assignment brief. The rules of
this codebase live in `docs/adr/`, so read those first.

## Requirements

- Node 20 or newer
- pnpm
- Docker (for PostgreSQL)
- Python 3.13 and [uv](https://docs.astral.sh/uv/) (only for the analytics service)

## Getting started

```bash
docker compose up -d        # PostgreSQL
pnpm install && pnpm build
pnpm test                   # green on a fresh clone
pnpm replay -- --file fixtures/events.jsonl   # prints: state=sha256:<...>
```

The replay CLI is the quickest way to see the system work. The event log is the
source of truth, and the state hash is how you check that two runs agree.

To run the API and projector against a real database, apply the schema and seed
first:

```bash
pnpm db:migrate
pnpm db:seed
```

## Analytics service (Python)

```bash
cd services/analytics
uv sync
DATABASE_URL=postgres://ats:ats@localhost:5432/ats uv run uvicorn app.main:app --port 8000
uv run pytest -q            # tests use a fake DB, so no live database is needed
```

More detail is in `services/analytics/app/README.md`.

## Layout

```
task/
├── packages/
│   ├── contracts/     # event & command schemas (zod) + event registry, the shared language
│   ├── engine/        # pure domain logic: decide/reduce functions. No I/O, no framework.
│   ├── api/           # NestJS REST API: commands in, events appended
│   ├── projector/     # consumes the event log, maintains read models in PostgreSQL
│   └── persistence/   # database access: entities, migrations, repositories
├── services/
│   └── analytics/     # FastAPI service: funnel and timing metrics read from projections
├── tools/
│   └── replay/        # CLI: replays an event log through the engine, prints a state hash
├── fixtures/
│   └── events.jsonl   # historical production events (v1)
└── docs/
    ├── adr/           # architecture decision records: the rules of this codebase
    └── product-notes.md
```

## Common commands

All of these run from the `task/` directory:

- `pnpm build` - build all packages
- `pnpm test` - run all tests
- `pnpm typecheck` - type-check all packages
- `pnpm lint` - run ESLint
- `pnpm format:check` - check formatting with Prettier
- `pnpm replay -- --file <path>` - replay an event log and print the state hash
- `pnpm db:migrate` - apply database migrations
- `pnpm db:seed` - seed the database

## Where to start

Read `docs/adr/` before you write any code. The ADRs are short and they are the
ground rules here. `docs/product-notes.md` gives the product context behind the
feature.
