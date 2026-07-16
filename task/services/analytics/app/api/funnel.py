"""GET /funnel: candidate count per pipeline stage."""

from fastapi import APIRouter

from app import db
from app.schemas.stages import STAGE_NAMES

router = APIRouter()


@router.get("/funnel")
async def funnel() -> dict[str, int]:
    """Count candidates per pipeline stage."""
    rows = await db.fetch_all("SELECT stage, COUNT(*) AS count FROM candidates_rm GROUP BY stage")

    counts: dict[str, int] = {name: 0 for name in STAGE_NAMES.values()}
    total = 0
    for row in rows:
        stage = row["stage"]
        count = row["count"]
        assert isinstance(stage, int)
        assert isinstance(count, int)
        name = STAGE_NAMES.get(stage)
        if name is not None:
            counts[name] += count
        total += count

    counts["total"] = total
    return counts
