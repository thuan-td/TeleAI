from app.db.models import CallRecord


def _dial(client, lead_id: str) -> str:
    response = client.post("/calls", json={"lead_id": lead_id})
    return response.json()["call_id"]


def test_call_analyzed_high_confidence_does_not_flag_review(client, sample_lead, db_session):
    call_id = _dial(client, str(sample_lead.id))

    payload = {
        "event": "call_analyzed",
        "call": {"call_id": call_id, "call_analysis": {"intent_confidence": 0.85}},
    }
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})

    assert response.status_code == 200
    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.intent_confidence == 0.85
    assert record.transfer_result is None


def test_call_analyzed_low_confidence_flags_review(client, sample_lead, db_session):
    call_id = _dial(client, str(sample_lead.id))

    payload = {
        "event": "call_analyzed",
        "call": {"call_id": call_id, "call_analysis": {"intent_confidence": 0.4}},
    }
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})

    assert response.status_code == 200
    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.transfer_result == "not_transferred_low_confidence"


def test_transfer_started_then_bridged_preserves_order(client, sample_lead, db_session):
    """AC3: Retell agent tự quyết định transfer — backend chỉ quan sát và ghi nhận
    context_sent_at (transfer_started) xảy ra trước audio_bridge_started_at (transfer_bridged)."""
    call_id = _dial(client, str(sample_lead.id))

    started_response = client.post(
        "/webhooks/retell",
        json={"event": "transfer_started", "call": {"call_id": call_id}},
        headers={"X-Webhook-Secret": "test-webhook-secret"},
    )
    bridged_response = client.post(
        "/webhooks/retell",
        json={"event": "transfer_bridged", "call": {"call_id": call_id}},
        headers={"X-Webhook-Secret": "test-webhook-secret"},
    )

    assert started_response.status_code == 200
    assert bridged_response.status_code == 200
    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.context_sent_at is not None
    assert record.audio_bridge_started_at is not None
    assert record.context_sent_at <= record.audio_bridge_started_at
    assert record.transfer_result == "transferred"


def test_transfer_cancelled_fallback_does_not_drop_call(client, sample_lead, db_session):
    call_id = _dial(client, str(sample_lead.id))

    payload = {"event": "transfer_cancelled", "call": {"call_id": call_id}}
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})

    assert response.status_code == 200
    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.transfer_result == "transfer_failed_fallback_continued"
    assert record.status != "ended"
