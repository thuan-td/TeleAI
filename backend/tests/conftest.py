import os
import uuid

os.environ.setdefault("RETELL_WEBHOOK_SECRET", "test-webhook-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.mock_provider import MockVoiceProvider
from app.core.config import Settings, get_settings
from app.core.security import SESSION_COOKIE_NAME, get_serializer, hash_password
from app.db.models import Base, Lead, User
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://teleapo:teleapo@localhost:5432/teleapo_test"

# Computed once per test session — bcrypt is slow, and every test-user login
# uses the same fixed password, so re-hashing it per test would be pure waste.
_TEST_PASSWORD_HASH = hash_password("test-password")


@pytest.fixture(scope="session")
def engine():
    import psycopg

    admin_conn = psycopg.connect("postgresql://teleapo:teleapo@localhost:5432/teleapo", autocommit=True)
    admin_conn.execute("DROP DATABASE IF EXISTS teleapo_test")
    admin_conn.execute("CREATE DATABASE teleapo_test")
    admin_conn.close()

    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine) -> Session:
    connection = engine.connect()
    outer_transaction = connection.begin()
    session_factory = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")
    session = session_factory()

    yield session

    session.close()
    outer_transaction.rollback()
    connection.close()


@pytest.fixture
def mock_provider() -> MockVoiceProvider:
    return MockVoiceProvider()


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        database_url=TEST_DATABASE_URL,
        retell_webhook_secret="test-webhook-secret",
        kb_webhook_secret="test-kb-webhook-secret",
        session_secret="test-session-secret-at-least-32-characters-long",
        allowed_phone_numbers="+84900000001",
        intent_confidence_threshold=0.7,
        max_call_retries=2,
    )


@pytest.fixture
def admin_user(db_session) -> User:
    user = User(username="test-admin", password_hash=_TEST_PASSWORD_HASH, role="admin")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def viewer_user(db_session) -> User:
    user = User(username="test-viewer", password_hash=_TEST_PASSWORD_HASH, role="viewer")
    db_session.add(user)
    db_session.commit()
    return user


def _client_for(user: User | None, db_session, mock_provider, test_settings) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_voice_provider] = lambda: mock_provider
    app.dependency_overrides[get_settings] = lambda: test_settings
    test_client = TestClient(app)
    if user is not None:
        token = get_serializer(test_settings).dumps({"uid": str(user.id)})
        test_client.cookies.set(SESSION_COOKIE_NAME, token)
    return test_client


@pytest.fixture
def client(admin_user, db_session, mock_provider, test_settings) -> TestClient:
    """Logged in as admin by default — most existing tests exercise
    admin-only endpoints (agent_config, kb, web_calls), so this is the
    fixture that needs the fewest call-site changes (phase-03 plan §Q4)."""
    test_client = _client_for(admin_user, db_session, mock_provider, test_settings)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def viewer_client(viewer_user, db_session, mock_provider, test_settings) -> TestClient:
    test_client = _client_for(viewer_user, db_session, mock_provider, test_settings)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def anon_client(db_session, mock_provider, test_settings) -> TestClient:
    test_client = _client_for(None, db_session, mock_provider, test_settings)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def sample_lead(db_session) -> Lead:
    lead = Lead(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        phone="+84900000001",
        name="Test Lead",
        lang="ja",
        status="new",
    )
    db_session.add(lead)
    db_session.commit()
    return lead
