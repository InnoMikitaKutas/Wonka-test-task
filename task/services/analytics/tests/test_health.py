"""Tests for GET /health. No real database is used; db.fetch_all is faked."""

from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)


def test_unknown_event_type_is_reported_as_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    """A type not in KNOWN_EVENT_TYPES must show up in ignored_event_types."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [
            {"type": "ApplicationReceived"},
            {"type": "StageChanged"},
            {"type": "AccountMerged"},
        ]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db"] == "connected"
    assert body["ignored_event_types"] == ["AccountMerged"]
    assert "ApplicationReceived" not in body["ignored_event_types"]


def test_only_known_event_types_gives_empty_ignored_list(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When every DB type is known, ignored_event_types is empty."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [
            {"type": "ApplicationReceived"},
            {"type": "StageChanged"},
            {"type": "ScoreAssigned"},
            {"type": "OfferExtended"},
            {"type": "SlotOpened"},
            {"type": "InterviewScheduled"},
            {"type": "ReservationPlaced"},
            {"type": "ReservationConfirmed"},
            {"type": "ReservationExpired"},
        ]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/health")

    body = response.json()
    assert body["ignored_event_types"] == []
    assert body["known_event_types"] == sorted(
        [
            "ApplicationReceived",
            "StageChanged",
            "ScoreAssigned",
            "OfferExtended",
            "SlotOpened",
            "InterviewScheduled",
            "ReservationPlaced",
            "ReservationConfirmed",
            "ReservationExpired",
        ]
    )


def test_db_error_gives_degraded_status_not_a_crash(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the DB call raises, /health must still answer with HTTP 200."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        raise RuntimeError("connection refused")

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "degraded"
    assert body["db"] == "unreachable"
    assert body["known_event_types"] == []
    assert body["ignored_event_types"] == []
