from functools import lru_cache

from fastapi import Depends, HTTPException

from app.adapters.mock_provider import MockVoiceProvider
from app.adapters.retell_adapter import RetellAdapter
from app.adapters.voice_provider import VoiceProvider
from app.core.config import Settings, get_settings


@lru_cache
def _mock_provider() -> MockVoiceProvider:
    return MockVoiceProvider()


def get_voice_provider(settings: Settings = Depends(get_settings)) -> VoiceProvider:
    if not settings.retell_api_key:
        return _mock_provider()
    return RetellAdapter(api_key=settings.retell_api_key, from_number=settings.retell_from_number)


def get_retell_admin_client(settings: Settings = Depends(get_settings)) -> RetellAdapter:
    """Admin/config client for agent_config.py router — always a real RetellAdapter,
    never the mock (config endpoints have nothing meaningful to mock against).
    503 if Retell isn't configured, per phase-03 plan §Quyết định 1."""
    if not settings.retell_api_key or not settings.retell_agent_id:
        raise HTTPException(
            status_code=503, detail="Chưa cấu hình RETELL_API_KEY/RETELL_AGENT_ID"
        )
    return RetellAdapter(api_key=settings.retell_api_key, from_number=settings.retell_from_number)
