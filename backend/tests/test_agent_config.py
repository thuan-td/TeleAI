from unittest.mock import MagicMock

import httpx

from app.adapters.retell_adapter import RetellAdapter
from app.db.models import AppSetting
from app.dependencies import get_retell_admin_client
from app.main import app

AGENT_ID = "agent-123"
LLM_ID = "llm-abc"


def _fake_admin() -> MagicMock:
    return MagicMock(spec=RetellAdapter)


def _http_error(status_code: int, text: str = "boom") -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://api.retellai.com/x")
    response = httpx.Response(status_code=status_code, request=request, text=text)
    return httpx.HTTPStatusError(text, request=request, response=response)


def test_get_agent_config_merges_agent_llm_and_local_threshold(client, test_settings, db_session):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "agent_name": "Sales Agent",
        "version": 3,
        "is_published": True,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
        "voice_id": "voice-1",
        "language": "ja-JP",
        "responsiveness": 0.8,
        "interruption_sensitivity": 0.5,
    }
    admin.get_llm.return_value = {
        "general_prompt": "You are a helpful sales agent.",
        "begin_message": "Hello!",
    }
    app.dependency_overrides[get_retell_admin_client] = lambda: admin
    db_session.add(AppSetting(key="intent_confidence_threshold", value="0.65"))
    db_session.commit()

    # Act
    response = client.get("/agent/config")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == AGENT_ID
    assert data["llm_id"] == LLM_ID
    assert data["general_prompt"] == "You are a helpful sales agent."
    assert data["begin_message"] == "Hello!"
    assert data["voice_id"] == "voice-1"
    assert data["intent_confidence_threshold"] == 0.65
    assert data["openai_realtime_language"] == "ja"
    assert data["openai_realtime_prompt"] == ""
    assert data["openai_realtime_voice"] == "marin"
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_get_agent_config_without_api_key_returns_503(client, test_settings):
    # Arrange
    test_settings.retell_api_key = ""
    test_settings.retell_agent_id = ""

    # Act
    response = client.get("/agent/config")

    # Assert
    assert response.status_code == 503


def test_patch_agent_config_prompt_change_calls_update_retell_llm(client, test_settings):
    # Arrange — LLM still draft (is_published=False), PATCH in place
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    admin.get_llm.return_value = {"llm_id": LLM_ID, "is_published": False}
    admin.publish_agent_version.return_value = {}
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"general_prompt": "New prompt", "publish": False})

    # Assert
    assert response.status_code == 200
    admin.update_llm.assert_called_once_with(LLM_ID, {"general_prompt": "New prompt"})
    admin.create_llm.assert_not_called()
    admin.update_agent.assert_not_called()
    data = response.json()
    assert data["updated_llm"] is True
    assert data["updated_agent"] is False
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_prompt_change_on_published_llm_creates_new_llm(client, test_settings):
    # Arrange — LLM already published (is_published=True) → immutable, must create new
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    admin.get_llm.return_value = {
        "llm_id": LLM_ID,
        "version": 3,
        "is_published": True,
        "general_prompt": "Old prompt",
        "begin_message": "Hello!",
    }
    admin.create_llm.return_value = {"llm_id": "llm-new-456"}
    admin.publish_agent_version.return_value = {}
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"general_prompt": "New prompt", "publish": False})

    # Assert
    assert response.status_code == 200
    admin.update_llm.assert_not_called()
    admin.create_llm.assert_called_once()
    created_fields = admin.create_llm.call_args.args[0]
    assert created_fields["general_prompt"] == "New prompt"
    assert created_fields["begin_message"] == "Hello!"
    assert "llm_id" not in created_fields
    assert "version" not in created_fields
    assert "is_published" not in created_fields
    admin.update_agent.assert_called_once_with(
        AGENT_ID, {"response_engine": {"type": "retell-llm", "llm_id": "llm-new-456"}}, version=1
    )
    data = response.json()
    assert data["updated_llm"] is True
    assert data["updated_agent"] is True
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_voice_change_on_published_agent_creates_new_version(client, test_settings):
    # Arrange — agent's current version is already published → immutable except version_title
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 2,
        "is_published": True,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    admin.create_agent_version.return_value = {"version": 3, "is_published": False}
    admin.publish_agent_version.return_value = {}
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"voice_id": "voice-2", "publish": True})

    # Assert
    assert response.status_code == 200
    admin.create_agent_version.assert_called_once_with(AGENT_ID, 2)
    admin.update_agent.assert_called_once_with(AGENT_ID, {"voice_id": "voice-2"}, version=3)
    admin.publish_agent_version.assert_called_once_with(AGENT_ID, 3)
    data = response.json()
    assert data["updated_agent"] is True
    assert data["published"] is True
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_voice_change_calls_update_agent(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    admin.publish_agent_version.return_value = {}
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"voice_id": "voice-2", "publish": False})

    # Assert
    assert response.status_code == 200
    admin.update_agent.assert_called_once_with(AGENT_ID, {"voice_id": "voice-2"}, version=1)
    admin.update_llm.assert_not_called()
    data = response.json()
    assert data["updated_agent"] is True
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_threshold_is_not_sent_to_retell(client, test_settings, db_session):
    # Arrange — regression: threshold is app-local only, must NEVER hit Retell (Insight 2)
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"intent_confidence_threshold": 0.9, "publish": False})

    # Assert
    assert response.status_code == 200
    admin.update_agent.assert_not_called()
    admin.update_llm.assert_not_called()
    admin.get_agent.assert_not_called()
    data = response.json()
    assert data["updated_local"] is True
    row = db_session.get(AppSetting, "intent_confidence_threshold")
    assert row is not None
    assert float(row.value) == 0.9
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_saves_openai_realtime_language(client, test_settings, db_session):
    # Arrange — app-local only, no Retell call needed (like intent_confidence_threshold)
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"openai_realtime_language": "vi", "publish": False})

    # Assert
    assert response.status_code == 200
    admin.update_agent.assert_not_called()
    admin.update_llm.assert_not_called()
    data = response.json()
    assert data["updated_local"] is True
    row = db_session.get(AppSetting, "openai_realtime_language")
    assert row is not None
    assert row.value == "vi"
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_rejects_unsupported_openai_realtime_language(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID

    # Act
    response = client.patch("/agent/config", json={"openai_realtime_language": "fr", "publish": False})

    # Assert
    assert response.status_code == 422


def test_patch_agent_config_saves_openai_realtime_prompt_and_voice(client, test_settings, db_session):
    # Arrange — app-local only, no Retell call needed
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch(
        "/agent/config",
        json={
            "openai_realtime_prompt": "You sell Tokyo real estate.",
            "openai_realtime_voice": "cedar",
            "publish": False,
        },
    )

    # Assert
    assert response.status_code == 200
    admin.update_agent.assert_not_called()
    admin.update_llm.assert_not_called()
    data = response.json()
    assert data["updated_local"] is True
    assert db_session.get(AppSetting, "openai_realtime_prompt").value == "You sell Tokyo real estate."
    assert db_session.get(AppSetting, "openai_realtime_voice").value == "cedar"
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_rejects_unsupported_openai_realtime_voice(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID

    # Act
    response = client.patch("/agent/config", json={"openai_realtime_voice": "not-a-real-voice", "publish": False})

    # Assert
    assert response.status_code == 422


def test_patch_agent_config_omits_none_fields_from_payload(client, test_settings):
    # Arrange — Retell PATCH is partial; sending null could wipe existing values
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch(
        "/agent/config",
        json={"voice_id": "voice-2", "responsiveness": None, "interruption_sensitivity": None, "publish": False},
    )

    # Assert
    assert response.status_code == 200
    admin.update_agent.assert_called_once_with(AGENT_ID, {"voice_id": "voice-2"}, version=1)
    call_payload = admin.update_agent.call_args.args[1]
    assert "responsiveness" not in call_payload
    assert "interruption_sensitivity" not in call_payload
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_publish_failure_returns_published_false_with_error(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "retell-llm", "llm_id": LLM_ID},
    }
    admin.update_agent.return_value = {}
    admin.publish_agent_version.side_effect = _http_error(500, "internal server error " * 20)
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"voice_id": "voice-2", "publish": True})

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["updated_agent"] is True
    assert data["published"] is False
    assert data["publish_error"] is not None
    assert len(data["publish_error"]) <= 200
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_patch_agent_config_upstream_error_returns_502(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.side_effect = _http_error(401, "unauthorized")
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.patch("/agent/config", json={"voice_id": "voice-2", "publish": False})

    # Assert
    assert response.status_code == 502
    assert "401" in response.json()["detail"]
    app.dependency_overrides.pop(get_retell_admin_client, None)


def test_webhook_uses_db_intent_threshold_over_env_default(client, sample_lead, db_session, test_settings):
    # Arrange — env default is 0.7 (test_settings fixture); DB override to 0.2 means
    # a 0.4 confidence call should now be treated as ABOVE threshold (not flagged).
    db_session.add(AppSetting(key="intent_confidence_threshold", value="0.2"))
    db_session.commit()
    dial_response = client.post("/calls", json={"lead_id": str(sample_lead.id)})
    call_id = dial_response.json()["call_id"]

    payload = {
        "event": "call_analyzed",
        "call": {"call_id": call_id, "call_analysis": {"intent_confidence": 0.4}},
    }

    # Act
    response = client.post("/webhooks/retell", json=payload, headers={"X-Webhook-Secret": "test-webhook-secret"})

    # Assert
    assert response.status_code == 200
    from app.db.models import CallRecord

    record = db_session.query(CallRecord).filter(CallRecord.call_id == call_id).first()
    assert record.intent_confidence == 0.4
    assert record.transfer_result is None  # NOT flagged — DB threshold (0.2) beats env (0.7)


def test_get_agent_config_custom_llm_engine_returns_null_prompt(client, test_settings):
    # Arrange
    test_settings.retell_api_key = "sk-test"
    test_settings.retell_agent_id = AGENT_ID
    admin = _fake_admin()
    admin.get_agent.return_value = {
        "agent_id": AGENT_ID,
        "version": 1,
        "response_engine": {"type": "custom-llm", "llm_websocket_url": "wss://example.com"},
        "voice_id": "voice-1",
        "language": "ja-JP",
    }
    app.dependency_overrides[get_retell_admin_client] = lambda: admin

    # Act
    response = client.get("/agent/config")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["llm_id"] is None
    assert data["general_prompt"] is None
    assert data["begin_message"] is None
    admin.get_llm.assert_not_called()
    app.dependency_overrides.pop(get_retell_admin_client, None)
