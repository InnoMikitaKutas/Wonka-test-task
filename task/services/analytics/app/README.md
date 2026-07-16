# ATS Analytics service

Reads the event log (`events` table) and the candidate projection
(`candidates_rm` table) from Postgres and turns them into a few hiring
metrics for the weekly report. Read-only; it never writes.

The event types in `app/schemas/events.py` mirror the contracts in
`packages/contracts` and are kept in sync by hand (see docs/adr/0002).

## Endpoints

- `GET /health`: service and database status.
- `GET /funnel`: candidate count per pipeline stage, plus a total.
- `GET /time-in-stage`: average seconds between consecutive stage
  changes, from the raw event log.

## How to run

Uses [uv](https://docs.astral.sh/uv/) for dependencies. `uv.lock` pins
exact versions. Needs Python 3.13 and a running Postgres with the schema
from `db/migrations/001_init.sql` applied.

```bash
cd services/analytics
uv sync

# DATABASE_URL defaults to postgres://ats:ats@localhost:5432/ats
DATABASE_URL=postgres://ats:ats@localhost:5432/ats uv run uvicorn app.main:app --port 8000
```

## Tests

```bash
uv run pytest -q
```

The tests replace the DB call with a fake, so they run without a live
database.
