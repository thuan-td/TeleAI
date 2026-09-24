import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.adapters.retell_adapter import RetellAdapter
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.dependencies import get_retell_admin_client
from app.services.app_settings import (
    OPENAI_LANGUAGE_NAMES,
    get_intent_threshold,
    get_openai_language,
    set_intent_threshold,
    set_openai_language,
)

router = APIRouter(prefix="/agent", tags=["agent-config"])

# In-process cache for /agent/voices — voice list is near-static, avoid
# hitting Retell on every page load (plan step 9). Not thread-safe by design
# (uvicorn workers each keep their own cache); acceptable for an internal tool.
_VOICES_CACHE_TTL_SECONDS = 5 * 60
_voices_cache: dict[str, Any] = {"data": None, "fetched_at": 0.0}


class AgentConfigResponse(BaseModel):
    agent_id: str
    agent_name: str | None
    llm_id: str | None
    version: int
    is_published: bool
    general_prompt: str | None
    begin_message: str | None
    voice_id: str
    language: str | list[str]
    responsiveness: float | None
    interruption_sensitivity: float | None
    intent_confidence_threshold: float
    openai_realtime_language: str


class AgentConfigUpdate(BaseModel):
    general_prompt: str | None = None
    begin_message: str | None = None
    voice_id: str | None = None
    language: str | None = None
    responsiveness: float | None = Field(None, ge=0, le=1)
    interruption_sensitivity: float | None = Field(None, ge=0, le=1)
    intent_confidence_threshold: float | None = Field(None, ge=0, le=1)
    openai_realtime_language: str | None = None
    publish: bool = True


class AgentConfigSaveResult(BaseModel):
    updated_agent: bool
    updated_llm: bool
    updated_local: bool
    published: bool
    publish_error: str | None = None


class VoiceOption(BaseModel):
    voice_id: str
    voice_name: str
    provider: str
    gender: str | None
    accent: str | None
    preview_audio_url: str | None


def _omit_none(fields: dict[str, Any]) -> dict[str, Any]:
    """Retell PATCH is partial — sending null can wipe an existing value.
    Only send keys whose value is not None (plan step 4/7, regression test
    test_patch_agent_config_omits_none_fields_from_payload)."""
    return {k: v for k, v in fields.items() if v is not None}


def _map_upstream_error(exc: httpx.HTTPStatusError) -> HTTPException:
    return HTTPException(
        status_code=502,
        detail=f"Retell trả {exc.response.status_code}: {exc.response.text[:200]}",
    )


@router.get("/config", response_model=AgentConfigResponse)
def get_agent_config(
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    admin: RetellAdapter = Depends(get_retell_admin_client),
) -> AgentConfigResponse:
    try:
        agent = admin.get_agent(settings.retell_agent_id)
    except httpx.HTTPStatusError as exc:
        raise _map_upstream_error(exc) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc

    response_engine = agent.get("response_engine") or {}
    llm_id: str | None = None
    general_prompt: str | None = None
    begin_message: str | None = None

    if response_engine.get("type") == "retell-llm":
        llm_id = response_engine.get("llm_id")
        if llm_id:
            try:
                llm = admin.get_llm(llm_id)
            except httpx.HTTPStatusError as exc:
                raise _map_upstream_error(exc) from exc
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc
            general_prompt = llm.get("general_prompt")
            begin_message = llm.get("begin_message")

    return AgentConfigResponse(
        agent_id=agent["agent_id"],
        agent_name=agent.get("agent_name"),
        llm_id=llm_id,
        version=agent.get("version", 0),
        is_published=agent.get("is_published", False),
        general_prompt=general_prompt,
        begin_message=begin_message,
        voice_id=agent.get("voice_id", ""),
        language=agent.get("language", "ja"),
        responsiveness=agent.get("responsiveness"),
        interruption_sensitivity=agent.get("interruption_sensitivity"),
        intent_confidence_threshold=get_intent_threshold(db, settings),
        openai_realtime_language=get_openai_language(db),
    )


@router.patch("/config", response_model=AgentConfigSaveResult)
def patch_agent_config(
    body: AgentConfigUpdate,
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
    admin: RetellAdapter = Depends(get_retell_admin_client),
) -> AgentConfigSaveResult:
    agent_fields = _omit_none(
        {
            "voice_id": body.voice_id,
            "language": body.language,
            "responsiveness": body.responsiveness,
            "interruption_sensitivity": body.interruption_sensitivity,
        }
    )
    llm_fields = _omit_none(
        {
            "general_prompt": body.general_prompt,
            "begin_message": body.begin_message,
        }
    )

    updated_agent = False
    updated_llm = False
    updated_local = False

    # Threshold is app-local only — NEVER sent to Retell (Insight 2 / regression
    # test test_patch_agent_config_threshold_is_not_sent_to_retell).
    if body.intent_confidence_threshold is not None:
        set_intent_threshold(db, body.intent_confidence_threshold)
        updated_local = True

    if body.openai_realtime_language is not None:
        if body.openai_realtime_language not in OPENAI_LANGUAGE_NAMES:
            raise HTTPException(
                status_code=422,
                detail=f"openai_realtime_language phải là một trong {list(OPENAI_LANGUAGE_NAMES)}",
            )
        set_openai_language(db, body.openai_realtime_language)
        updated_local = True

    llm_id: str | None = None
    target_version: int | None = None
    if agent_fields or llm_fields:
        try:
            agent = admin.get_agent(settings.retell_agent_id)
        except httpx.HTTPStatusError as exc:
            raise _map_upstream_error(exc) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc
        response_engine = agent.get("response_engine") or {}
        if response_engine.get("type") == "retell-llm":
            llm_id = response_engine.get("llm_id")

        target_version = agent.get("version", 0)
        if agent.get("is_published"):
            # A published agent version is immutable except version_title
            # (PATCH /update-agent 422s "Cannot update published agent other
            # than version title") — clone a fresh draft first, then target
            # that draft for both the PATCH below and the publish call.
            try:
                draft = admin.create_agent_version(settings.retell_agent_id, target_version)
            except httpx.HTTPStatusError as exc:
                raise _map_upstream_error(exc) from exc
            except httpx.HTTPError as exc:
                raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc
            target_version = draft["version"]

    if llm_fields:
        if not llm_id:
            raise HTTPException(
                status_code=422,
                detail="Agent không dùng retell-llm (response_engine khác), không thể sửa prompt",
            )
        try:
            current_llm = admin.get_llm(llm_id)
        except httpx.HTTPStatusError as exc:
            raise _map_upstream_error(exc) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc

        try:
            if current_llm.get("is_published"):
                # Published LLM is immutable (PATCH /update-retell-llm 400s
                # "Cannot update published LLM") — create a new LLM cloned
                # from the current config + new fields, then point the agent
                # at it below via response_engine.llm_id.
                new_llm_fields = {**current_llm, **llm_fields}
                new_llm_fields.pop("llm_id", None)
                new_llm_fields.pop("version", None)
                new_llm_fields.pop("is_published", None)
                new_llm = admin.create_llm(new_llm_fields)
                llm_id = new_llm["llm_id"]
                agent_fields["response_engine"] = {"type": "retell-llm", "llm_id": llm_id}
            else:
                admin.update_llm(llm_id, llm_fields)
        except httpx.HTTPStatusError as exc:
            raise _map_upstream_error(exc) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc
        updated_llm = True

    if agent_fields:
        try:
            admin.update_agent(settings.retell_agent_id, agent_fields, version=target_version)
        except httpx.HTTPStatusError as exc:
            raise _map_upstream_error(exc) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc
        updated_agent = True

    published = False
    publish_error: str | None = None
    retell_changed = updated_agent or updated_llm

    if retell_changed and body.publish:
        try:
            # target_version already points at the draft we edited above
            # (either the original draft, or the one create_agent_version
            # cloned) — do NOT re-fetch get_agent here, it would return the
            # still-published version, not the draft we just changed.
            admin.publish_agent_version(settings.retell_agent_id, target_version)
            published = True
        except httpx.HTTPStatusError as exc:
            publish_error = f"Retell trả {exc.response.status_code}: {exc.response.text}"[:200]
        except httpx.HTTPError as exc:
            publish_error = str(exc)[:200]

    return AgentConfigSaveResult(
        updated_agent=updated_agent,
        updated_llm=updated_llm,
        updated_local=updated_local,
        published=published,
        publish_error=publish_error,
    )


@router.get("/voices", response_model=list[VoiceOption])
def list_agent_voices(
    admin: RetellAdapter = Depends(get_retell_admin_client),
) -> list[VoiceOption]:
    now = time.monotonic()
    if _voices_cache["data"] is not None and (now - _voices_cache["fetched_at"]) < _VOICES_CACHE_TTL_SECONDS:
        return _voices_cache["data"]

    try:
        voices = admin.list_voices()
    except httpx.HTTPStatusError as exc:
        raise _map_upstream_error(exc) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Không gọi được Retell API: {exc}") from exc

    options = [
        VoiceOption(
            voice_id=v["voice_id"],
            voice_name=v.get("voice_name", v["voice_id"]),
            provider=v.get("provider", ""),
            gender=v.get("gender"),
            accent=v.get("accent"),
            preview_audio_url=v.get("preview_audio_url"),
        )
        for v in voices
    ]
    _voices_cache["data"] = options
    _voices_cache["fetched_at"] = now
    return options
