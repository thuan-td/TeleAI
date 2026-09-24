import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.retell_adapter import RetellAdapter
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.services.app_settings import OPENAI_LANGUAGE_NAMES, get_openai_language

router = APIRouter(prefix="/calls", tags=["calls"])

OPENAI_REALTIME_MODEL = "gpt-realtime"
OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"

# Reused across requests instead of opening a new connection per call (httpx.post
# would do a fresh TCP+TLS handshake every time).
_openai_client = httpx.Client(timeout=30.0)


class WebCallResponse(BaseModel):
    access_token: str


class OpenAIWebCallResponse(BaseModel):
    client_secret: str
    expires_at: int
    model: str


@router.post("/web", response_model=WebCallResponse, status_code=201)
def start_web_call(
    settings: Settings = Depends(get_settings),
    provider: RetellAdapter = Depends(get_voice_provider),
) -> WebCallResponse:
    """Dev/test-only: start a Retell Web Call from the browser (no phone number).

    Requires the real RetellAdapter (RETELL_API_KEY configured) and
    RETELL_AGENT_ID set — the mock provider used when Retell isn't configured
    has no equivalent, so this 503s until Retell is set up for real.
    """
    if not isinstance(provider, RetellAdapter):
        raise HTTPException(status_code=503, detail="Retell chưa được cấu hình (RETELL_API_KEY trống)")
    if not settings.retell_agent_id:
        raise HTTPException(status_code=503, detail="Thiếu RETELL_AGENT_ID trong cấu hình")

    try:
        access_token = provider.create_web_call(settings.retell_agent_id)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"Retell trả lỗi khi tạo web call: {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc

    return WebCallResponse(access_token=access_token)


def _build_language_instructions(language: str) -> str:
    """OpenAI Realtime has no dedicated output-language field (confirmed via
    docs research 2026-09-24) — spoken language is only steerable through
    `instructions` text. Reliability is model-dependent (medium confidence),
    accepted for this dev/test-only tool."""
    language_name = OPENAI_LANGUAGE_NAMES.get(language, OPENAI_LANGUAGE_NAMES["ja"])
    return f"You are a helpful voice assistant. Respond exclusively in {language_name}, regardless of the language the user speaks. Never switch to another language."


@router.post("/web/openai", response_model=OpenAIWebCallResponse, status_code=201)
def start_openai_web_call(
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> OpenAIWebCallResponse:
    """Dev/test-only: mint an OpenAI Realtime ephemeral client secret for a browser WebRTC test session.

    Verified against developers.openai.com/api/docs/guides/voice-webrtc (2026-09-23):
    POST https://api.openai.com/v1/realtime/client_secrets with the real OPENAI_API_KEY
    (server-side only, never sent to the browser) returns a short-lived secret
    (`value` + `expires_at`) the frontend uses as the WebRTC Authorization Bearer
    token when POSTing its SDP offer straight to
    https://api.openai.com/v1/realtime/calls. This is a standalone test utility —
    not part of VoiceProvider/outbound-call flow, no phone/SIP involved.
    """
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI chưa được cấu hình (OPENAI_API_KEY trống)")

    language = get_openai_language(db)

    try:
        response = _openai_client.post(
            OPENAI_CLIENT_SECRETS_URL,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "session": {
                    "type": "realtime",
                    "model": OPENAI_REALTIME_MODEL,
                    "instructions": _build_language_instructions(language),
                }
            },
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"OpenAI trả lỗi khi tạo client secret: {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Không gọi được OpenAI API: {exc}") from exc

    payload = response.json()
    return OpenAIWebCallResponse(
        client_secret=payload["value"],
        expires_at=payload["expires_at"],
        model=OPENAI_REALTIME_MODEL,
    )
