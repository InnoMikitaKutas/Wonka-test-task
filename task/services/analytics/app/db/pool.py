"""Shared async Postgres connection pool and typed row access."""

from collections.abc import Sequence

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

_pool: AsyncConnectionPool | None = None


def set_pool(pool: AsyncConnectionPool | None) -> None:
    global _pool
    _pool = pool


def get_pool() -> AsyncConnectionPool | None:
    return _pool


async def fetch_all(
    query: str, params: Sequence[object] | None = None
) -> list[dict[str, object]]:
    """Run a query and return all rows as string-keyed dicts.

    Row values come back typed as `object`; callers narrow each column
    to the type they expect.
    """
    if _pool is None:
        raise RuntimeError("connection pool is not initialized")
    async with _pool.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(query, params)
            return await cur.fetchall()
