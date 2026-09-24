import uuid
from datetime import datetime

from pydantic import BaseModel


class CreateLeadRequest(BaseModel):
    phone: str
    name: str
    lang: str = "ja"


class UpdateLeadRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    lang: str | None = None
    status: str | None = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    phone: str
    name: str
    lang: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadDetailResponse(LeadResponse):
    call_count: int
    last_call_at: datetime | None = None


class PaginatedLeads(BaseModel):
    items: list[LeadResponse]
    total: int
    page: int
    page_size: int
