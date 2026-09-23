from unittest.mock import MagicMock, patch

import httpx

from app.adapters.retell_adapter import RetellAdapter
from app.dependencies import get_voice_provider
from app.main import app


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


def test_openai_web_call_start_returns_client_secret_when_configured(client, test_settings):
    # Arrange
    test_settings.openai_api_key = "sk-test-key"
    fake_response = MagicMock()
    fake_response.json.return_value = {"value": "ek_test-secret", "expires_at": 1735689600}
    fake_response.raise_for_status.return_value = None

    # Act
    with patch("app.routers.web_calls.httpx.post", return_value=fake_response) as fake_post:
        response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 201
    assert response.json() == {
        "client_secret": "ek_test-secret",
        "expires_at": 1735689600,
        "model": "gpt-realtime",
    }
    fake_post.assert_called_once()
    called_url = fake_post.call_args.args[0]
    called_kwargs = fake_post.call_args.kwargs
    assert called_url == "https://api.openai.com/v1/realtime/client_secrets"
    assert called_kwargs["headers"]["Authorization"] == "Bearer sk-test-key"
    assert called_kwargs["json"]["session"]["model"] == "gpt-realtime"


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
        "app.routers.web_calls.httpx.post",
        side_effect=httpx.HTTPStatusError("unauthorized", request=fake_request, response=fake_response),
    ):
        response = client.post("/calls/web/openai")

    # Assert
    assert response.status_code == 502
    assert "401" in response.json()["detail"]
