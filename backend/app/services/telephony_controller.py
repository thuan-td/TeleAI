from sqlalchemy.orm import Session

from app.db.models import CallRecord
from app.services.intent_rules import should_transfer

INVALID_NUMBER_STATUS = "invalid_number"
NO_ANSWER_STATUS = "no_answer"
NOT_INTERESTED_STATUS = "not_interested"


def handle_invalid_number(db: Session, record: CallRecord) -> None:
    record.status = INVALID_NUMBER_STATUS
    record.retry_count = 0
    db.commit()


def handle_no_answer(db: Session, record: CallRecord, max_retries: int) -> None:
    record.status = NO_ANSWER_STATUS
    if record.retry_count < max_retries:
        record.retry_count += 1
    db.commit()


def flag_low_confidence_for_review(db: Session, record: CallRecord, threshold: float) -> bool:
    """AC11 review log only — Retell's Agent decides transfer itself (dashboard-configured
    Transfer Call Tool), backend cannot trigger or block it. This just flags low-confidence
    calls for a human to review afterward; it does not call any provider API."""
    if should_transfer(record.intent_confidence, threshold):
        return False
    record.transfer_result = "not_transferred_low_confidence"
    db.commit()
    return True
