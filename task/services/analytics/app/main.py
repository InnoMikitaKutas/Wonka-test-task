"""ATS Analytics service: hiring funnel and timing metrics from the event log."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from psycopg_pool import AsyncConnectionPool

from app import db
from app.api import funnel, health, timing
from app.core.config import POOL_MAX_SIZE, POOL_MIN_SIZE, get_database_url


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    pool = AsyncConnectionPool(
        get_database_url(), min_size=POOL_MIN_SIZE, max_size=POOL_MAX_SIZE, open=False
    )
    await pool.open()
    db.set_pool(pool)
    try:
        yield
    finally:
        # close the pool we opened above
        await pool.close()
        db.set_pool(None)


def create_app() -> FastAPI:
    app = FastAPI(title="ATS Analytics", lifespan=lifespan)
    app.include_router(health.router)
    app.include_router(funnel.router)
    app.include_router(timing.router)
    return app


app = create_app()
