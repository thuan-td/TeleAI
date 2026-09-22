from app.db.models import CallRecord, WebhookEvent


def _webhook_payload(call_id: str, start_timestamp: int = 1700000000000) -> dict:
    return {
        "event": "call_started",
        "call": {"call_id": call_id, "call_status": "in_progress", "start_timestamp": start_timestamp},
    }


def test_webhook_replay_is_idempotent(client, sample_lead, db_session):
    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    payload = _webhook_payload(call_id)

    for _ in range(5):
        response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})
        assert response.status_code == 200

    call_records = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).all()
    assert len(call_records) == 1

    expected_dedup_key = f"{call_id}:call_started:1700000000000"
    webhook_events = db_session.query(WebhookEvent).filter(WebhookEvent.provider_event_id == expected_dedup_key).all()
    assert len(webhook_events) == 1


def test_webhook_updates_call_status_on_first_delivery(client, sample_lead, db_session):
    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    payload = _webhook_payload(call_id, start_timestamp=1700000001000)
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})

    assert response.status_code == 200
    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.status == "in_progress"
    assert record.started_at is not None
