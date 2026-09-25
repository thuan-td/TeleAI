import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.adapters.voice_provider import VoiceProvider
from app.core.config import Settings, get_settings
from app.db.models import CallRecord, Lead, WebhookEvent
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.schemas.calls import CallDetailResponse, CallFilters, CallListItem, PaginatedCalls
from app.services.call_export import stream_calls_csv
from app.services.call_query import build_call_query

router = APIRouter(prefix="/calls", tags=["calls"])

EXPORT_ROW_LIMIT = 10_000


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


def _to_list_item(record: CallRecord, lead_name: str, lead_phone: str) -> CallListItem:
    duration_seconds = None
    if record.started_at and record.ended_at:
        duration_seconds = int((record.ended_at - record.started_at).total_seconds())

    return CallListItem(
        call_id=record.call_id,
        lead_id=record.lead_id,
        lead_name=lead_name,
        lead_phone=lead_phone,
        status=record.status,
        started_at=record.started_at,
        ended_at=record.ended_at,
        duration_seconds=duration_seconds,
        transfer_result=record.transfer_result,
        intent_confidence=record.intent_confidence,
        recording_url=record.recording_url,
        transcript_status=record.transcript_status,
    )


@router.get("", response_model=PaginatedCalls)
def list_calls(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    lead_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> PaginatedCalls:
    filters = CallFilters(status=status, lead_id=lead_id, date_from=date_from, date_to=date_to, q=q)
    query = build_call_query(db, filters)

    total = db.scalar(select(func.count()).select_from(query.subquery()))

    rows = db.execute(
        query.order_by(CallRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    items = [_to_list_item(record, lead_name, lead_phone) for record, lead_name, lead_phone in rows]

    return PaginatedCalls(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/export", dependencies=[Depends(require_admin)])
def export_calls(
    status: str | None = None,
    lead_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    filters = CallFilters(status=status, lead_id=lead_id, date_from=date_from, date_to=date_to, q=q)
    query = build_call_query(db, filters)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    if total > EXPORT_ROW_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Kết quả quá lớn ({total} hàng), vui lòng thu hẹp bộ lọc",
        )

    rows = db.execute(query.order_by(CallRecord.created_at.desc())).yield_per(500)

    today = datetime.now(timezone.utc).date().isoformat()
    return StreamingResponse(
        stream_calls_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="calls-{today}.csv"'},
    )


@router.get("/{call_id}", response_model=CallDetailResponse)
def get_call_detail(call_id: str, db: Session = Depends(get_db)) -> CallDetailResponse:
    row = db.execute(
        select(CallRecord, Lead.name, Lead.phone)
        .join(Lead, CallRecord.lead_id == Lead.id)
        .where(CallRecord.call_id == call_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="call not found")

    record, lead_name, lead_phone = row
    list_item = _to_list_item(record, lead_name, lead_phone)

    transcript = _get_transcript(db, call_id)

    return CallDetailResponse(
        **list_item.model_dump(),
        retry_count=record.retry_count,
        context_sent_at=record.context_sent_at,
        audio_bridge_started_at=record.audio_bridge_started_at,
        transcript=transcript,
    )


def _get_transcript(db: Session, call_id: str) -> str | None:
    """Transcript is not stored on CallRecord (see phase-02 plan §Quyết định 2);
    read it from the latest webhook_events row that carries it, via JSONB path."""
    event = db.execute(
        select(WebhookEvent)
        .where(WebhookEvent.raw_payload["call"]["call_id"].astext == call_id)
        .where(WebhookEvent.raw_payload["call"]["transcript"].astext.isnot(None))
        .order_by(WebhookEvent.received_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    if event is None:
        return None
    return event.raw_payload.get("call", {}).get("transcript")
