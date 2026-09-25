import uuid
from functools import lru_cache

from pydantic import Field
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
    # Public URL Retell's custom-function webhook calls back into (Retell
    # rejects `localhost` — confirmed via docs research 2026-09-24). Needs a
    # tunnel (ngrok/cloudflared) in dev, a real domain in production.
    app_public_url: str = ""
    # Shared secret sent by Retell as a custom header on the KB custom-function
    # call (configured in _knowledge_base_tool()'s `headers`) and checked in
    # POST /kb/retell-function-call — without this the webhook is a public,
    # unauthenticated read of the entire knowledge base (code review finding,
    # 2026-09-24). Same pattern as retell_webhook_secret, different endpoint
    # (that one guards the Retell *event* webhook, this guards the *custom
    # function* webhook — separate Retell features, separate secrets).
    kb_webhook_secret: str = ""
    allowed_phone_numbers: str = ""
    intent_confidence_threshold: float = 0.7
    max_call_retries: int = 2
    # Signs the session cookie (itsdangerous) — treat like retell_webhook_secret,
    # never commit. Generate with: openssl rand -hex 32
    session_secret: str = Field(min_length=32)
    # False in dev (plain HTTP on localhost); set true in prod (HTTPS only).
    cookie_secure: bool = False
    session_max_age_seconds: int = 28800

    def allowed_numbers(self) -> set[str]:
        return {n.strip() for n in self.allowed_phone_numbers.split(",") if n.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
