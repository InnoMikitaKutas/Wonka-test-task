"""Tests for GET /time-in-stage. No real database is used; db.fetch_all is faked."""

from collections.abc import Sequence
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)


def test_time_in_stage_averages_gaps_per_candidate(monkeypatch: pytest.MonkeyPatch) -> None:
    """Gaps are only measured between consecutive events of the same candidate."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [
            {"candidate_id": "c1", "occurred_at": datetime(2024, 1, 1, 0, 0, 0)},
            {"candidate_id": "c1", "occurred_at": datetime(2024, 1, 1, 0, 10, 0)},
            {"candidate_id": "c2", "occurred_at": datetime(2024, 1, 1, 0, 0, 0)},
        ]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/time-in-stage")

    assert response.status_code == 200
    body = response.json()
    assert body["sample_size"] == 1
    assert body["average_seconds_between_stage_changes"] == 600.0


def test_time_in_stage_with_no_gaps_returns_null_average(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A candidate with a single StageChanged event forms no gap."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [{"candidate_id": "c1", "occurred_at": datetime(2024, 1, 1, 0, 0, 0)}]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/time-in-stage")

    assert response.status_code == 200
    body = response.json()
    assert body["sample_size"] == 0
    assert body["average_seconds_between_stage_changes"] is None
