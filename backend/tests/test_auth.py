from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.models import User


def _create_user(db_session, *, username: str, password: str, role: str, is_active: bool = True) -> User:
    user = User(username=username, password_hash=hash_password(password), role=role, is_active=is_active)
    db_session.add(user)
    db_session.commit()
    return user


def test_login_with_correct_credentials_sets_session_cookie(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")

    response = client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    assert response.status_code == 200
    assert response.json()["username"] == "admin"
    assert response.json()["role"] == "admin"
    assert "teleapo_session" in response.cookies


def test_login_with_wrong_password_returns_401(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")

    response = client.post("/auth/login", json={"username": "admin", "password": "wrong"})

    assert response.status_code == 401


def test_login_with_nonexistent_user_returns_same_error_as_wrong_password(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")

    wrong_password = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    nonexistent_user = client.post("/auth/login", json={"username": "nosuchuser", "password": "wrong"})

    assert wrong_password.status_code == nonexistent_user.status_code == 401
    assert wrong_password.json()["detail"] == nonexistent_user.json()["detail"]


def test_login_with_deactivated_user_returns_401(client: TestClient, db_session):
    _create_user(db_session, username="ex-employee", password="secret123", role="viewer", is_active=False)

    response = client.post("/auth/login", json={"username": "ex-employee", "password": "secret123"})

    assert response.status_code == 401


def test_me_without_cookie_returns_401(anon_client: TestClient):
    response = anon_client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_valid_session_cookie_returns_current_user(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")
    client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_logout_clears_session_cookie(anon_client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")
    anon_client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    logout_response = anon_client.post("/auth/logout")
    me_response = anon_client.get("/auth/me")

    assert logout_response.status_code == 204
    assert me_response.status_code == 401


def test_me_rejects_session_of_user_deactivated_after_login(client: TestClient, db_session):
    user = _create_user(db_session, username="admin", password="secret123", role="admin")
    client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    user.is_active = False
    db_session.commit()

    response = client.get("/auth/me")

    assert response.status_code == 401


def test_tampered_session_cookie_returns_401(anon_client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")
    anon_client.post("/auth/login", json={"username": "admin", "password": "secret123"})
    anon_client.cookies.set("teleapo_session", "tampered-value-not-a-real-signed-token")

    response = anon_client.get("/auth/me")

    assert response.status_code == 401


def test_anonymous_leads_list_returns_401(anon_client: TestClient):
    response = anon_client.get("/leads")

    assert response.status_code == 401


def test_health_endpoint_public_returns_200(anon_client: TestClient):
    response = anon_client.get("/health")

    assert response.status_code == 200


def test_viewer_calls_export_returns_403(viewer_client: TestClient):
    response = viewer_client.get("/calls/export")

    assert response.status_code == 403


def test_viewer_agent_config_get_returns_403(viewer_client: TestClient):
    response = viewer_client.get("/agent/config")

    assert response.status_code == 403


def test_viewer_kb_documents_returns_403(viewer_client: TestClient):
    response = viewer_client.get("/kb/documents")

    assert response.status_code == 403


def test_viewer_web_call_returns_403(viewer_client: TestClient):
    response = viewer_client.post("/calls/web", json={})

    assert response.status_code == 403


def test_viewer_leads_list_returns_200(viewer_client: TestClient):
    response = viewer_client.get("/leads")

    assert response.status_code == 200


def test_retell_webhook_works_without_session_cookie(anon_client: TestClient, test_settings):
    response = anon_client.post(
        "/webhooks/retell",
        headers={"X-Webhook-Secret": test_settings.retell_webhook_secret},
        json={"event": "call_started", "call": {"call_id": "no-such-call"}},
    )

    assert response.status_code == 200


def test_kb_retell_function_call_works_without_session_cookie(anon_client: TestClient, test_settings):
    response = anon_client.post(
        "/kb/retell-function-call",
        headers={"X-KB-Webhook-Secret": test_settings.kb_webhook_secret},
        json={"name": "query_knowledge_base", "args": {"query": "test"}},
    )

    assert response.status_code == 200


_ROUTE_ALLOWLIST = {
    "/health",
    "/auth/login",
    "/auth/logout",
    "/auth/me",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/webhooks/retell",
    "/kb/retell-function-call",
}


def test_all_routes_except_allowlist_require_auth_dependency():
    """Guards against a future endpoint being added without auth by mistake —
    every route not explicitly allowlisted above must depend (directly or via
    the router-level `include_router(..., dependencies=[...])`) on
    get_current_user. See phase-02-router-protection.md."""
    from app.auth import get_current_user
    from app.main import app

    unprotected = []
    for route in app.routes:
        path = getattr(route, "path", None)
        if path is None or path in _ROUTE_ALLOWLIST:
            continue
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        # get_current_user is a SUB-dependency of require_user/require_admin
        # (not listed directly), so check one level of nesting too.
        depends_on_auth = any(
            dep.call is get_current_user or any(sub.call is get_current_user for sub in dep.dependencies)
            for dep in dependant.dependencies
        )
        if not depends_on_auth:
            unprotected.append(path)

    assert unprotected == []
