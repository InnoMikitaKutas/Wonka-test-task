"""Pipeline stage enum and name mapping."""

from enum import IntEnum


class Stage(IntEnum):
    """1-based to match the API and legacy portal (ADR 0003)."""

    APPLIED = 1
    SCREENING = 2
    INTERVIEW = 3
    OFFER = 4
    HIRED = 5


STAGE_NAMES: dict[int, str] = {stage.value: stage.name.lower() for stage in Stage}
