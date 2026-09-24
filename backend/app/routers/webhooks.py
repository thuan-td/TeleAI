import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.voice_provider import VoiceProvider
from app.core.clock import utcnow
from app.core.config import Settings, get_settings
from app.db.models import CallRecord, WebhookEvent
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.services.app_settings import get_intent_threshold
from app.services.telephony_controller import (
    INVALID_NUMBER_STATUS,
    NO_ANSWER_STATUS,
    flag_low_confidence_for_review,
    handle_invalid_number,
    handle_no_answer,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

TERMINAL_STATUS_MAP = {
    "invalid_number": INVALID_NUMBER_STATUS,
    "no_answer": NO_ANSWER_STATUS,
    "not_interested": "not_interested",
}


@router.post("/retell", status_code=200)
async def retell_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    provider: VoiceProvider = Depends(get_voice_provider),
    x_webhook_secret: str | None = Header(default=None),
) -> dict[str, str]:
    if x_webhook_secret != settings.retell_webhook_secret:
        raise HTTPException(status_code=401, detail="invalid webhook secret")

    payload: dict[str, Any] = await request.json()
    event = provider.parse_webhook(payload)

    webhook_row = WebhookEvent(
        provider_event_id=event.provider_event_id,
        event_type=event.event_type,
        raw_payload=payload,
    )
    db.add(webhook_row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate_ignored"}

    record = db.query(CallRecord).filter(CallRecord.call_id == event.call_id).first()
    if record is None:
        webhook_row.processed_at = utcnow()
        db.commit()
        return {"status": "no_matching_call"}

    _apply_event(db, record, event, settings)
    webhook_row.processed_at = utcnow()
    db.commit()
    return {"status": "processed"}


def _apply_event(db: Session, record: CallRecord, event: Any, settings: Settings) -> None:
    """Retell decides transfer itself (configured on the Agent in its dashboard,
    per docs.retellai.com/build/single-multi-prompt/transfer-call) — backend only
    observes transfer_* webhook events, it never triggers a transfer via API."""
    if event.event_type == "call_started":
        record.status = "in_progress"
        record.started_at = utcnow()
    elif event.event_type == "call_analyzed":
        if event.intent_confidence is not None:
            record.intent_confidence = event.intent_confidence
            flag_low_confidence_for_review(db, record, get_intent_threshold(db, settings))
        if event.transcript_status:
            record.transcript_status = event.transcript_status
        if event.recording_url:
            record.recording_url = event.recording_url
    elif event.event_type == "transfer_started":
        record.context_sent_at = utcnow()
        record.transfer_result = "transfer_started"
    elif event.event_type == "transfer_bridged":
        record.audio_bridge_started_at = utcnow()
        record.transfer_result = "transferred"
    elif event.event_type in ("transfer_cancelled", "transfer_ended"):
        # Đích không bắt máy/huỷ (1.D.3 fallback) — AI tiếp tục cuộc gọi, không rớt call.
        record.transfer_result = "transfer_failed_fallback_continued"
    elif event.event_type == "call_ended":
        record.ended_at = utcnow()
        mapped_status = TERMINAL_STATUS_MAP.get(event.status or "", event.status or "ended")
        if mapped_status == INVALID_NUMBER_STATUS:
            handle_invalid_number(db, record)
        elif mapped_status == NO_ANSWER_STATUS:
            handle_no_answer(db, record, settings.max_call_retries)
        else:
            record.status = mapped_status
        if event.intent_confidence is not None:
            record.intent_confidence = event.intent_confidence
    else:
        logger.warning("unhandled retell event_type=%s call_id=%s", event.event_type, event.call_id)
    db.commit()
