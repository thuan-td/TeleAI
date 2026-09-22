import uuid

from app.db.models import CallRecord
from app.services.intent_rules import should_transfer
from app.services.telephony_controller import (
    flag_low_confidence_for_review,
    handle_invalid_number,
    handle_no_answer,
)


def _make_call_record(db_session, sample_lead) -> CallRecord:
    record = CallRecord(call_id=f"call-{uuid.uuid4()}", lead_id=sample_lead.id, status="dialing")
    db_session.add(record)
    db_session.commit()
    return record


def test_invalid_number_goes_to_dlq_without_retry(db_session, sample_lead):
    record = _make_call_record(db_session, sample_lead)

    handle_invalid_number(db_session, record)

    assert record.status == "invalid_number"
    assert record.retry_count == 0


def test_no_answer_stops_at_max_retries(db_session, sample_lead):
    record = _make_call_record(db_session, sample_lead)

    for _ in range(5):
        handle_no_answer(db_session, record, max_retries=2)

    assert record.status == "no_answer"
    assert record.retry_count == 2


def test_low_confidence_flags_review_log(db_session, sample_lead):
    record = _make_call_record(db_session, sample_lead)
    record.intent_confidence = 0.3
    db_session.commit()

    flagged = flag_low_confidence_for_review(db_session, record, threshold=0.7)

    assert flagged is True
    assert record.transfer_result == "not_transferred_low_confidence"


def test_high_confidence_does_not_flag_review(db_session, sample_lead):
    record = _make_call_record(db_session, sample_lead)
    record.intent_confidence = 0.9
    db_session.commit()

    flagged = flag_low_confidence_for_review(db_session, record, threshold=0.7)

    assert flagged is False
    assert record.transfer_result is None


def test_should_transfer_boundary_at_threshold():
    assert should_transfer(0.7, 0.7) is True
    assert should_transfer(0.69, 0.7) is False
    assert should_transfer(None, 0.7) is False
