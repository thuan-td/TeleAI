def test_list_calls_returns_created_call(client, sample_lead):
    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    response = client.get("/calls")

    assert response.status_code == 200
    call_ids = [c["call_id"] for c in response.json()]
    assert call_id in call_ids


def test_webhook_rejects_wrong_secret_when_configured(client, sample_lead, test_settings):
    test_settings.retell_webhook_secret = "correct-secret"

    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    payload = {
        "event": "call_started",
        "call": {"call_id": call_id, "call_status": "in_progress"},
    }
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "wrong-secret"})

    assert response.status_code == 401


def test_webhook_accepts_correct_secret_when_configured(client, sample_lead, test_settings):
    test_settings.retell_webhook_secret = "correct-secret"

    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    payload = {
        "event": "call_started",
        "call": {"call_id": call_id, "call_status": "in_progress"},
    }
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "correct-secret"})

    assert response.status_code == 200
