import uuid
from datetime import date, datetime

from pydantic import BaseModel


class CallFilters(BaseModel):
    status: str | None = None
    lead_id: uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None
    q: str | None = None


class CallListItem(BaseModel):
    call_id: str
    lead_id: uuid.UUID
    lead_name: str
    lead_phone: str
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    duration_seconds: int | None
    transfer_result: str | None
    intent_confidence: float | None
    recording_url: str | None
    transcript_status: str


class PaginatedCalls(BaseModel):
    items: list[CallListItem]
    total: int
    page: int
    page_size: int


class CallDetailResponse(CallListItem):
    retry_count: int
    context_sent_at: datetime | None
    audio_bridge_started_at: datetime | None
    transcript: str | None
