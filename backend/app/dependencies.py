from functools import lru_cache

from fastapi import Depends

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
