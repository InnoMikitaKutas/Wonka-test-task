"""GET /time-in-stage: average seconds between consecutive stage changes."""

from datetime import datetime

from fastapi import APIRouter

from app import db

router = APIRouter()


@router.get("/time-in-stage")
async def time_in_stage() -> dict[str, object]:
    """Average gap in seconds between consecutive StageChanged events per candidate."""
    rows = await db.fetch_all(
        """
        SELECT payload ->> 'candidateId' AS candidate_id, occurred_at
        FROM events
        WHERE type = 'StageChanged'
        ORDER BY payload ->> 'candidateId', occurred_at
        """
    )

    gaps: list[float] = []
    prev_candidate_id: str | None = None
    prev_time: datetime | None = None

    for row in rows:
        candidate_id = row["candidate_id"]
        occurred_at = row["occurred_at"]
        assert isinstance(candidate_id, str)
        assert isinstance(occurred_at, datetime)
        if candidate_id == prev_candidate_id and prev_time is not None:
            gap_seconds = (occurred_at - prev_time).total_seconds()
            gaps.append(gap_seconds)
        prev_candidate_id = candidate_id
        prev_time = occurred_at

    if not gaps:
        return {"average_seconds_between_stage_changes": None, "sample_size": 0}

    average = sum(gaps) / len(gaps)
    return {"average_seconds_between_stage_changes": average, "sample_size": len(gaps)}
