def test_create_lead_returns_201_with_lead_fields(client):
    response = client.post("/leads", json={"phone": "+84900000001", "name": "Dev Test Lead", "lang": "ja"})

    assert response.status_code == 201
    body = response.json()
    assert body["phone"] == "+84900000001"
    assert body["name"] == "Dev Test Lead"
    assert body["lang"] == "ja"
    assert body["status"] == "new"


def test_list_leads_returns_created_lead(client):
    create_response = client.post("/leads", json={"phone": "+84900000002", "name": "Another Lead"})
    lead_id = create_response.json()["id"]

    response = client.get("/leads")

    assert response.status_code == 200
    lead_ids = [lead["id"] for lead in response.json()]
    assert lead_id in lead_ids


def test_create_lead_defaults_lang_to_ja(client):
    response = client.post("/leads", json={"phone": "+84900000003", "name": "No Lang Lead"})

    assert response.status_code == 201
    assert response.json()["lang"] == "ja"
