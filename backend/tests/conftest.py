import os
import uuid

os.environ.setdefault("RETELL_WEBHOOK_SECRET", "test-webhook-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.adapters.mock_provider import MockVoiceProvider
from app.core.config import Settings, get_settings
from app.db.models import Base, Lead
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.main import app

TEST_DATABASE_URL = "postgresql+psycopg://teleapo:teleapo@localhost:5432/teleapo_test"


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
        allowed_phone_numbers="+84900000001",
        intent_confidence_threshold=0.7,
        max_call_retries=2,
    )


@pytest.fixture
def client(db_session, mock_provider, test_settings) -> TestClient:
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_voice_provider] = lambda: mock_provider
    app.dependency_overrides[get_settings] = lambda: test_settings
    yield TestClient(app)
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
