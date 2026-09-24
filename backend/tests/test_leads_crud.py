import uuid

from app.db.models import CallRecord, Lead


def test_list_leads_with_search_query_returns_only_matching(client, db_session):
    db_session.add_all(
        [
            Lead(id=uuid.uuid4(), organization_id=uuid.uuid4(), phone="+84900000010", name="Tanaka San", lang="ja", status="new"),
            Lead(id=uuid.uuid4(), organization_id=uuid.uuid4(), phone="+84900000011", name="Suzuki San", lang="ja", status="new"),
        ]
    )
    db_session.commit()

    response = client.get("/leads", params={"q": "tanaka"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Tanaka San"


def test_list_leads_pagination_returns_correct_total_and_slice(client, db_session):
    for i in range(5):
        db_session.add(
            Lead(
                id=uuid.uuid4(),
                organization_id=uuid.uuid4(),
                phone=f"+8490000{i:04d}",
                name=f"Lead {i}",
                lang="ja",
                status="new",
            )
        )
    db_session.commit()

    response = client.get("/leads", params={"page": 1, "page_size": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert body["page"] == 1
    assert body["page_size"] == 2
    assert len(body["items"]) == 2


def test_get_lead_detail_returns_call_count_and_last_call_at(client, db_session, sample_lead):
    db_session.add_all(
        [
            CallRecord(id=uuid.uuid4(), call_id="call-1", lead_id=sample_lead.id, status="completed"),
            CallRecord(id=uuid.uuid4(), call_id="call-2", lead_id=sample_lead.id, status="completed"),
        ]
    )
    db_session.commit()

    response = client.get(f"/leads/{sample_lead.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["call_count"] == 2


def test_patch_lead_partial_update_changes_only_given_fields(client, sample_lead):
    response = client.patch(f"/leads/{sample_lead.id}", json={"status": "contacted"})

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "contacted"
    assert body["name"] == sample_lead.name
    assert body["phone"] == sample_lead.phone


def test_delete_lead_soft_deletes_and_excludes_from_list(client, sample_lead):
    delete_response = client.delete(f"/leads/{sample_lead.id}")
    assert delete_response.status_code == 204

    list_response = client.get("/leads")
    lead_ids = [item["id"] for item in list_response.json()["items"]]
    assert str(sample_lead.id) not in lead_ids

    get_response = client.get(f"/leads/{sample_lead.id}")
    assert get_response.status_code == 404


def test_delete_lead_keeps_existing_call_records(client, db_session, sample_lead):
    record = CallRecord(id=uuid.uuid4(), call_id="call-keep", lead_id=sample_lead.id, status="completed")
    db_session.add(record)
    db_session.commit()

    response = client.delete(f"/leads/{sample_lead.id}")
    assert response.status_code == 204

    still_there = db_session.get(CallRecord, record.id)
    assert still_there is not None
    assert still_there.lead_id == sample_lead.id


def test_list_leads_page_size_over_limit_returns_422(client):
    response = client.get("/leads", params={"page_size": 101})

    assert response.status_code == 422
