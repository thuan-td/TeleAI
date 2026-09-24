import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.adapters.retell_adapter import RetellAdapter
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.dependencies import get_voice_provider
from app.services.app_settings import (
    OPENAI_LANGUAGE_NAMES,
    get_openai_language,
    get_openai_model,
    get_openai_prompt,
    get_openai_voice,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/calls", tags=["calls"])

OPENAI_CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets"
OPENAI_TRANSLATE_MODEL = "gpt-4o-mini"
OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"

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


def _translate_prompt(api_key: str, prompt: str, language_name: str) -> str:
    """Translate the user-authored prompt into the selected spoken language
    before it reaches Realtime's `instructions`. Fixes a real bug found
    2026-09-24: appending "Respond exclusively in {language}" AFTER a prompt
    written in a different language gives the model two conflicting
    directives (follow the script vs. obey the language rule), and it tends
    to pick the language rule, drifting off-script. Translating removes the
    conflict outright — same content, no cross-language instruction.

    Uses Chat Completions (gpt-4o-mini, not the Realtime model — this is a
    plain text task, Realtime pricing is per-audio-minute and would be
    wasteful here). Falls back to the original prompt on any failure so a
    translation hiccup never blocks minting the session."""
    try:
        response = _openai_client.post(
            OPENAI_CHAT_COMPLETIONS_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": OPENAI_TRANSLATE_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            f"Translate the user's text into {language_name}. "
                            "Keep the tone, intent, and any names/company names unchanged. "
                            "Output ONLY the translation, no commentary."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except (httpx.HTTPError, KeyError, IndexError) as exc:
        logger.warning("OpenAI prompt translation failed, falling back to original prompt: %s", exc)
        return prompt


def _build_instructions(api_key: str, prompt: str, language: str) -> str:
    """OpenAI Realtime has no dedicated output-language field (confirmed via
    docs research 2026-09-24) — spoken language is only steerable through
    `instructions` text. The user-authored prompt is translated into the
    selected language first (see _translate_prompt), then the language
    directive is appended so both agree — no cross-language conflict."""
    language_name = OPENAI_LANGUAGE_NAMES.get(language, OPENAI_LANGUAGE_NAMES["ja"])
    base_prompt = prompt.strip() or "You are a helpful voice assistant."
    translated_prompt = _translate_prompt(api_key, base_prompt, language_name)
    language_instruction = (
        f"Respond exclusively in {language_name}, regardless of the language the user speaks. "
        "Never switch to another language."
    )
    return f"{translated_prompt}\n\n{language_instruction}"


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
    prompt = get_openai_prompt(db)
    voice = get_openai_voice(db)
    model = get_openai_model(db)

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
                    "model": model,
                    "instructions": _build_instructions(settings.openai_api_key, prompt, language),
                    # Confirmed live against api.openai.com 2026-09-24: `voice`
                    # is NOT a top-level session field (that 400s with
                    # "Unknown parameter: 'session.voice'") — it lives under
                    # audio.output.voice.
                    "audio": {"output": {"voice": voice}},
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
        model=model,
    )
