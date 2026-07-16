"""GET /health: service and database status."""

from fastapi import APIRouter

from app import db
from app.schemas.events import KNOWN_EVENT_TYPES

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, object]:
    """Report DB status and any event types the mirror in app/schemas/events.py does not know."""
    try:
        rows = await db.fetch_all("SELECT DISTINCT type FROM events")
        db_types = {str(row["type"]) for row in rows}
        ignored = sorted(db_types - KNOWN_EVENT_TYPES)
        return {
            "status": "ok",
            "db": "connected",
            "known_event_types": sorted(KNOWN_EVENT_TYPES),
            "ignored_event_types": ignored,
        }
    except Exception:
        return {
            "status": "degraded",
            "db": "unreachable",
            "known_event_types": [],
            "ignored_event_types": [],
        }
