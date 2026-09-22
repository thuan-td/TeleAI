import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.voice_provider import VoiceProvider
from app.core.config import Settings, get_settings
from app.db.models import CallRecord, Lead
from app.db.session import get_db
from app.dependencies import get_voice_provider

router = APIRouter(prefix="/calls", tags=["calls"])


class DialRequest(BaseModel):
    lead_id: uuid.UUID


class DialResponse(BaseModel):
    call_id: str
    status: str
    recording_url: str | None = None
    transcript_status: str = "pending"


@router.post("", response_model=DialResponse, status_code=201)
def dial(
    body: DialRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    provider: VoiceProvider = Depends(get_voice_provider),
) -> DialResponse:
    lead = db.get(Lead, body.lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="lead not found")

    allowed = settings.allowed_numbers()
    if allowed and lead.phone not in allowed:
        raise HTTPException(status_code=403, detail="phone number not in whitelist")

    call_id = provider.place_call(lead.phone, lead.lang, {"lead_name": lead.name})

    record = CallRecord(call_id=call_id, lead_id=lead.id, status="dialing")
    db.add(record)
    db.commit()

    return DialResponse(call_id=call_id, status=record.status, transcript_status=record.transcript_status)


@router.get("", response_model=list[DialResponse])
def list_calls(db: Session = Depends(get_db)) -> list[DialResponse]:
    records = db.query(CallRecord).order_by(CallRecord.started_at.desc().nullslast()).all()
    return [
        DialResponse(
            call_id=r.call_id,
            status=r.status,
            recording_url=r.recording_url,
            transcript_status=r.transcript_status,
        )
        for r in records
    ]
