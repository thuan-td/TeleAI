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


def test_me_without_cookie_returns_401(client: TestClient):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_valid_session_cookie_returns_current_user(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")
    client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_logout_clears_session_cookie(client: TestClient, db_session):
    _create_user(db_session, username="admin", password="secret123", role="admin")
    client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    logout_response = client.post("/auth/logout")
    me_response = client.get("/auth/me")

    assert logout_response.status_code == 204
    assert me_response.status_code == 401


def test_me_rejects_session_of_user_deactivated_after_login(client: TestClient, db_session):
    user = _create_user(db_session, username="admin", password="secret123", role="admin")
    client.post("/auth/login", json={"username": "admin", "password": "secret123"})

    user.is_active = False
    db_session.commit()

    response = client.get("/auth/me")

    assert response.status_code == 401
