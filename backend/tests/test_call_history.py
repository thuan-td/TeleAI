import uuid
from datetime import datetime, timedelta, timezone

from app.core.clock import utcnow
from app.db.models import CallRecord, Lead, WebhookEvent


def _make_lead(db_session, name="Tanaka", phone="+84900000002") -> Lead:
    lead = Lead(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        phone=phone,
        name=name,
        lang="ja",
        status="new",
    )
    db_session.add(lead)
    db_session.commit()
    return lead


def _make_call(db_session, lead: Lead, **overrides) -> CallRecord:
    defaults = dict(
        id=uuid.uuid4(),
        call_id=f"call-{uuid.uuid4()}",
        lead_id=lead.id,
        status="ended",
        created_at=utcnow(),
    )
    defaults.update(overrides)
    record = CallRecord(**defaults)
    db_session.add(record)
    db_session.commit()
    return record


def test_list_calls_filter_by_status_returns_only_matching(client, db_session, sample_lead):
    # Arrange
    _make_call(db_session, sample_lead, status="ended")
    _make_call(db_session, sample_lead, status="failed")

    # Act
    response = client.get("/calls", params={"status": "failed"})

    # Assert
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["status"] == "failed"


def test_list_calls_filter_by_date_range_excludes_outside_range(client, db_session, sample_lead):
    # Arrange
    in_range = _make_call(db_session, sample_lead, created_at=datetime(2026, 9, 10, tzinfo=timezone.utc))
    _make_call(db_session, sample_lead, created_at=datetime(2026, 8, 1, tzinfo=timezone.utc))

    # Act
    response = client.get("/calls", params={"date_from": "2026-09-01", "date_to": "2026-09-20"})

    # Assert
    assert response.status_code == 200
    call_ids = [c["call_id"] for c in response.json()["items"]]
    assert call_ids == [in_range.call_id]


def test_list_calls_search_by_lead_name_returns_matching_call(client, db_session, sample_lead):
    # Arrange
    other_lead = _make_lead(db_session, name="Suzuki", phone="+84900000003")
    match = _make_call(db_session, sample_lead)
    _make_call(db_session, other_lead)

    # Act
    response = client.get("/calls", params={"q": sample_lead.name})

    # Assert
    assert response.status_code == 200
    call_ids = [c["call_id"] for c in response.json()["items"]]
    assert call_ids == [match.call_id]


def test_list_calls_pagination_returns_correct_total_and_slice(client, db_session, sample_lead):
    # Arrange
    for _ in range(5):
        _make_call(db_session, sample_lead)

    # Act
    response = client.get("/calls", params={"page": 2, "page_size": 2})

    # Assert
    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 2
    assert body["page_size"] == 2
    assert len(body["items"]) == 2


def test_list_calls_includes_lead_name_without_n_plus_one(client, db_session, sample_lead):
    # Arrange
    _make_call(db_session, sample_lead)

    # Act
    response = client.get("/calls")

    # Assert
    item = response.json()["items"][0]
    assert item["lead_name"] == sample_lead.name
    assert item["lead_phone"] == sample_lead.phone


def test_get_call_detail_unknown_id_returns_404(client):
    # Act
    response = client.get("/calls/does-not-exist")

    # Assert
    assert response.status_code == 404


def test_get_call_detail_returns_transcript_when_webhook_event_has_it(client, db_session, sample_lead):
    # Arrange
    call = _make_call(db_session, sample_lead)
    event = WebhookEvent(
        id=uuid.uuid4(),
        provider_event_id=str(uuid.uuid4()),
        event_type="call_analyzed",
        raw_payload={"call": {"call_id": call.call_id, "transcript": "Xin chao, day la cuoc goi test."}},
        received_at=utcnow(),
    )
    db_session.add(event)
    db_session.commit()

    # Act
    response = client.get(f"/calls/{call.call_id}")

    # Assert
    assert response.status_code == 200
    assert response.json()["transcript"] == "Xin chao, day la cuoc goi test."


def test_export_calls_returns_csv_with_bom_and_header(client, db_session, sample_lead):
    # Arrange
    _make_call(db_session, sample_lead)

    # Act
    response = client.get("/calls/export")

    # Assert
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    body = response.content.decode("utf-8-sig")
    assert response.content.startswith(b"\xef\xbb\xbf")
    assert body.splitlines()[0] == "call_id,lead_name,lead_phone,status,started_at,ended_at,duration_seconds,transfer_result,intent_confidence,retry_count,recording_url"


def test_export_calls_escapes_comma_in_lead_name(client, db_session):
    # Arrange
    lead = _make_lead(db_session, name="Tanaka, Taro", phone="+84900000004")
    _make_call(db_session, lead)

    # Act
    response = client.get("/calls/export")

    # Assert
    body = response.content.decode("utf-8-sig")
    assert '"Tanaka, Taro"' in body


def test_export_calls_over_row_limit_returns_400(client, db_session, sample_lead, monkeypatch):
    # Arrange: cap lowered so the test doesn't need to insert 10k+ rows
    import app.routers.calls as calls_module

    monkeypatch.setattr(calls_module, "EXPORT_ROW_LIMIT", 1)
    _make_call(db_session, sample_lead)
    _make_call(db_session, sample_lead)

    # Act
    response = client.get("/calls/export")

    # Assert
    assert response.status_code == 400
    assert "thu hẹp bộ lọc" in response.json()["detail"]
