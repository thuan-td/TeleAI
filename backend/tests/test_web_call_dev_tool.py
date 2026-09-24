from unittest.mock import MagicMock, patch

import httpx

from app.adapters.retell_adapter import RetellAdapter
from app.db.models import AppSetting
from app.dependencies import get_voice_provider
from app.main import app

REALTIME_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"
CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


def _mock_openai_post(translated_text: str | None = None):
    """_openai_client.post is now called twice per /calls/web/openai request:
    once to translate the prompt (chat/completions), once to mint the
    Realtime session (realtime/client_secrets). Route each by URL so tests
    don't have to care about call order."""
    mint_response = MagicMock()
    mint_response.json.return_value = {"value": "ek_test-secret", "expires_at": 1735689600}
    mint_response.raise_for_status.return_value = None

    translate_response = MagicMock()
    translate_response.json.return_value = {
        "choices": [{"message": {"content": translated_text or "(translated)"}}]
    }
    translate_response.raise_for_status.return_value = None

    def _dispatch(url, **kwargs):
        if url == CHAT_COMPLETIONS_URL:
            return translate_response
        return mint_response

    return _dispatch


def test_web_call_start_returns_access_token_when_retell_configured(client, test_settings):
    # Arrange
    test_settings.retell_agent_id = "agent-123"
    fake_retell = MagicMock(spec=RetellAdapter)
    fake_retell.create_web_call.return_value = "test-access-token"
    app.dependency_overrides[get_voice_provider] = lambda: fake_retell

    # Act
    response = client.post("/calls/web")

    # Assert
    assert response.status_code == 201
    assert response.json() == {"access_token": "test-access-token"}
    fake_retell.create_web_call.assert_called_once_with("agent-123")


def test_web_call_start_rejects_when_provider_is_mock(client, mock_provider, test_settings):
    # Arrange: mock_provider (default override from `client` fixture) is not a RetellAdapter
    test_settings.retell_agent_id = "agent-123"

    # Act
    response = client.post("/calls/web")

    # Assert
    assert response.status_code == 503
    assert "Retell" in response.json()["detail"]


def test_web_call_start_rejects_when_agent_id_missing(client, test_settings):
    # Arrange
    test_settings.retell_agent_id = ""
    fake_retell = MagicMock(spec=RetellAdapter)
    app.dependency_overrides[get_voice_provider] = lambda: fake_retell

    # Act
    response = client.post("/calls/web")

    # Assert
    assert response.status_code == 503
    assert "RETELL_AGENT_ID" in response.json()["detail"]
    fake_retell.create_web_call.assert_not_called()


def test_web_call_start_returns_502_when_retell_errors(client, test_settings):
    # Arrange
    test_settings.retell_agent_id = "agent-123"
    fake_retell = MagicMock(spec=RetellAdapter)
    fake_request = httpx.Request("POST", "https://api.retellai.com/v2/create-web-call")
    fake_response = httpx.Response(status_code=401, request=fake_request)
    fake_retell.create_web_call.side_effect = httpx.HTTPStatusError(
        "unauthorized", request=fake_request, response=fake_response
    )
    app.dependency_overrides[get_voice_provider] = lambda: fake_retell

    # Act
    response = client.post("/calls/web")

    # Assert
    assert response.status_code == 502
    assert "401" in response.json()["detail"]


def test_retell_adapter_create_web_call_posts_agent_id_and_returns_token():
    # Arrange
    fake_http_client = MagicMock()
    fake_response = MagicMock()
    fake_response.json.return_value = {"access_token": "abc-token"}
    fake_http_client.post.return_value = fake_response
    adapter = RetellAdapter(api_key="key", from_number="+1", client=fake_http_client)

    # Act
    token = adapter.create_web_call("agent-xyz")

    # Assert
    assert token == "abc-token"
    fake_http_client.post.assert_called_once_with("/v2/create-web-call", json={"agent_id": "agent-xyz"})
    fake_response.raise_for_status.assert_called_once()


def _mint_session_call(fake_post):
    """Find the call that hit realtime/client_secrets (as opposed to the
    translation call to chat/completions)."""
    for call in fake_post.call_args_list:
        if call.args and call.args[0] == REALTIME_SECRETS_URL:
            return call
    raise AssertionError("no call to realtime/client_secrets found")


def test_openai_web_call_start_returns_client_secret_when_configured(client, test_settings):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"

    # Act
    with patch("app.routers.web_calls._openai_client.post", side_effect=_mock_openai_post()) as fake_post:
        response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 201
    assert response.json() == {
        "client_secret": "ek_test-secret",
        "expires_at": 1735689600,
        "model": "gpt-realtime",
    }
    mint_call = _mint_session_call(fake_post)
    assert mint_call.kwargs["headers"]["Authorization"] == "Bearer sk-test-key"
    assert mint_call.kwargs["json"]["session"]["model"] == "gpt-realtime"


def test_openai_web_call_start_defaults_instructions_to_japanese_when_no_setting(client, test_settings):
    # Arrange — no AppSetting row saved yet, DEFAULT_OPENAI_LANGUAGE = "ja"
    test_settings.openai_api_key = "sk-test-key"

    # Act
    with patch("app.routers.web_calls._openai_client.post", side_effect=_mock_openai_post()) as fake_post:
        client.post("/calls/web/openai")

    # Assert
    instructions = _mint_session_call(fake_post).kwargs["json"]["session"]["instructions"]
    assert "Japanese" in instructions


def test_openai_web_call_start_uses_saved_language_setting(client, test_settings, db_session):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"
    db_session.add(AppSetting(key="openai_realtime_language", value="vi"))
    db_session.commit()

    # Act
    with patch("app.routers.web_calls._openai_client.post", side_effect=_mock_openai_post()) as fake_post:
        client.post("/calls/web/openai")

    # Assert
    instructions = _mint_session_call(fake_post).kwargs["json"]["session"]["instructions"]
    assert "Vietnamese" in instructions


def test_openai_web_call_start_defaults_voice_to_marin_when_no_setting(client, test_settings):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"

    # Act
    with patch("app.routers.web_calls._openai_client.post", side_effect=_mock_openai_post()) as fake_post:
        client.post("/calls/web/openai")

    # Assert
    mint_call = _mint_session_call(fake_post)
    assert mint_call.kwargs["json"]["session"]["audio"]["output"]["voice"] == "marin"


def test_openai_web_call_start_uses_saved_voice_and_prompt(client, test_settings, db_session):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"
    db_session.add(AppSetting(key="openai_realtime_voice", value="cedar"))
    db_session.add(AppSetting(key="openai_realtime_prompt", value="You sell Tokyo real estate."))
    db_session.commit()

    # Act
    with patch(
        "app.routers.web_calls._openai_client.post",
        side_effect=_mock_openai_post(translated_text="You sell Tokyo real estate."),
    ) as fake_post:
        client.post("/calls/web/openai")

    # Assert
    session = _mint_session_call(fake_post).kwargs["json"]["session"]
    assert session["audio"]["output"]["voice"] == "cedar"
    assert "You sell Tokyo real estate." in session["instructions"]
    assert "Japanese" in session["instructions"]  # language directive still appended


def test_openai_web_call_start_translates_prompt_before_sending(client, test_settings, db_session):
    # Arrange — regression for the real bug found 2026-09-24: a Vietnamese
    # prompt + language="en" produced conflicting instructions and the model
    # drifted off-script. Translation must resolve the conflict.
    test_settings.openai_api_key = "sk-test-key"
    db_session.add(AppSetting(key="openai_realtime_language", value="en"))
    db_session.add(AppSetting(key="openai_realtime_prompt", value="Xin chào, tôi là Sato."))
    db_session.commit()

    # Act
    with patch(
        "app.routers.web_calls._openai_client.post",
        side_effect=_mock_openai_post(translated_text="Hello, this is Sato."),
    ) as fake_post:
        client.post("/calls/web/openai")

    # Assert
    translate_calls = [c for c in fake_post.call_args_list if c.args and c.args[0] == CHAT_COMPLETIONS_URL]
    assert len(translate_calls) == 1
    assert translate_calls[0].kwargs["json"]["messages"][1]["content"] == "Xin chào, tôi là Sato."
    assert "English" in translate_calls[0].kwargs["json"]["messages"][0]["content"]

    instructions = _mint_session_call(fake_post).kwargs["json"]["session"]["instructions"]
    assert "Hello, this is Sato." in instructions
    assert "Xin chào" not in instructions  # original-language text must not leak into the final instructions


def test_openai_web_call_start_falls_back_to_original_prompt_when_translation_fails(client, test_settings, db_session):
    # Arrange — translation is best-effort; a translation failure must not
    # block minting the session.
    test_settings.openai_api_key = "sk-test-key"
    db_session.add(AppSetting(key="openai_realtime_prompt", value="Xin chào, tôi là Sato."))
    db_session.commit()
    fake_request = httpx.Request("POST", CHAT_COMPLETIONS_URL)
    fake_translate_error_response = httpx.Response(status_code=500, request=fake_request)

    mint_response = MagicMock()
    mint_response.json.return_value = {"value": "ek_test-secret", "expires_at": 1735689600}
    mint_response.raise_for_status.return_value = None

    def _dispatch(url, **kwargs):
        if url == CHAT_COMPLETIONS_URL:
            raise httpx.HTTPStatusError("boom", request=fake_request, response=fake_translate_error_response)
        return mint_response

    # Act
    with patch("app.routers.web_calls._openai_client.post", side_effect=_dispatch):
        response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 201
    assert response.json()["client_secret"] == "ek_test-secret"


def test_openai_web_call_start_rejects_when_api_key_missing(client, test_settings):
    # Arrange
    test_settings.openai_api_key = ""

    # Act
    response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_openai_web_call_start_returns_502_when_openai_errors(client, test_settings):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"
    fake_request = httpx.Request("POST", "https://api.openai.com/v1/realtime/client_secrets")
    fake_response = httpx.Response(status_code=401, request=fake_request)

    # Act
    with patch(
        "app.routers.web_calls._openai_client.post",
        side_effect=httpx.HTTPStatusError("unauthorized", request=fake_request, response=fake_response),
    ):
        response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 502
    assert "401" in response.json()["detail"]
