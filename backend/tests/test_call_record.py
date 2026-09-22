from app.db.models import CallRecord


def test_dial_creates_call_record_with_required_fields(client, sample_lead, db_session):
    response = client.post("/calls", json={"lead_id": str(sample_lead.id)})

    assert response.status_code == 201
    call_id = response.json()["call_id"]

    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record is not None
    assert record.call_id
    assert record.lead_id == sample_lead.id
    assert record.status == "dialing"
    assert record.transcript_status == "pending"


def test_dial_rejects_phone_outside_whitelist(client, db_session):
    import uuid

    from app.db.models import Lead

    lead = Lead(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        phone="+81900000099",
        name="Outside Whitelist",
        lang="ja",
        status="new",
    )
    db_session.add(lead)
    db_session.commit()

    response = client.post("/calls", json={"lead_id": str(lead.id)})

    assert response.status_code == 403


def test_dial_unknown_lead_returns_404(client):
    import uuid

    response = client.post("/calls", json={"lead_id": str(uuid.uuid4())})

    assert response.status_code == 404
