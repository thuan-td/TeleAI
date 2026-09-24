import uuid
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Fixed default org until multi-tenant auth is added (YAGNI — internal tool, no billing).
DEFAULT_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://teleapo:teleapo@localhost:5432/teleapo"
    retell_api_key: str = ""
    retell_webhook_secret: str
    retell_from_number: str = ""
    retell_agent_id: str = ""
    openai_api_key: str = ""
    allowed_phone_numbers: str = ""
    intent_confidence_threshold: float = 0.7
    max_call_retries: int = 2

    def allowed_numbers(self) -> set[str]:
        return {n.strip() for n in self.allowed_phone_numbers.split(",") if n.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
