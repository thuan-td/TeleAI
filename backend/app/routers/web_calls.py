import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.adapters.retell_adapter import RetellAdapter
from app.core.config import Settings, get_settings
from app.dependencies import get_voice_provider

router = APIRouter(prefix="/calls", tags=["calls"])

OPENAI_REALTIME_MODEL = "gpt-realtime"
OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"


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

    access_token = provider.create_web_call(settings.retell_agent_id)
    return WebCallResponse(access_token=access_token)


@router.post("/web/openai", response_model=OpenAIWebCallResponse, status_code=201)
def start_openai_web_call(
    settings: Settings = Depends(get_settings),
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

    try:
        response = httpx.post(
            OPENAI_CLIENT_SECRETS_URL,
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "session": {
                    "type": "realtime",
                    "model": OPENAI_REALTIME_MODEL,
                }
            },
            timeout=30.0,
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
