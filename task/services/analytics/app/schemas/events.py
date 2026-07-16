"""Hand-written mirror of packages/contracts v1 events. Keep in sync by hand."""

from pydantic import BaseModel, Field

KNOWN_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "ApplicationReceived",
        "StageChanged",
        "ScoreAssigned",
        "OfferExtended",
        "SlotOpened",
        "InterviewScheduled",
        "ReservationPlaced",
    }
)


class ApplicationReceivedPayload(BaseModel):
    """A candidate applied for a position."""

    candidateId: str
    name: str
    position: str
    source: str


class StageChangedPayload(BaseModel):
    """A candidate moved between pipeline stages. 1-based, 1 to 5 (ADR 0003)."""

    candidateId: str
    fromStage: int = Field(ge=1, le=5)
    toStage: int = Field(ge=1, le=5)


class ScoreAssignedPayload(BaseModel):
    """Score is a decimal string with two digits, e.g. "87.50" (ADR 0003). Keep as str."""

    candidateId: str
    score: str
    assessor: str


class OfferExtendedPayload(BaseModel):
    """An offer was extended to a candidate."""

    candidateId: str
    note: str


class SlotOpenedPayload(BaseModel):
    """An interviewer opened a new interview slot."""

    slotId: str
    interviewer: str
    startsAt: str


class InterviewScheduledPayload(BaseModel):
    """A candidate was scheduled into an interview slot."""

    slotId: str
    candidateId: str


class ReservationPlacedPayload(BaseModel):
    """A pending reservation was placed on a slot."""

    reservationId: str
    slotId: str
    candidateId: str
    expiresAt: str


def is_known(event_type: str) -> bool:
    return event_type in KNOWN_EVENT_TYPES
