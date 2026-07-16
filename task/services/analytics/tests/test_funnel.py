"""Tests for GET /funnel. No real database is used; db.fetch_all is faked."""

from collections.abc import Sequence

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

client = TestClient(app)


def test_funnel_maps_1_based_stage_numbers_to_names(monkeypatch: pytest.MonkeyPatch) -> None:
    """Stage is 1-based (ADR 0003): 1 is applied, 5 is hired."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [
            {"stage": 1, "count": 10},
            {"stage": 2, "count": 5},
            {"stage": 3, "count": 3},
            {"stage": 4, "count": 2},
            {"stage": 5, "count": 1},
        ]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/funnel")

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] == 10
    assert body["screening"] == 5
    assert body["interview"] == 3
    assert body["offer"] == 2
    assert body["hired"] == 1
    assert body["total"] == 21


def test_funnel_fills_in_zero_for_stages_with_no_candidates(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Stages missing from the DB result still appear, with a count of 0."""

    async def fake_fetch_all(
        query: str, params: Sequence[object] | None = None
    ) -> list[dict[str, object]]:
        return [{"stage": 1, "count": 4}]

    monkeypatch.setattr(db, "fetch_all", fake_fetch_all)

    response = client.get("/funnel")

    body = response.json()
    assert body["applied"] == 4
    assert body["screening"] == 0
    assert body["interview"] == 0
    assert body["offer"] == 0
    assert body["hired"] == 0
    assert body["total"] == 4
