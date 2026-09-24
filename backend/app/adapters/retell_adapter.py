from typing import Any

import httpx

from app.adapters.voice_provider import VoiceProvider, WebhookEventData

RETELL_BASE_URL = "https://api.retellai.com"


class RetellAdapter(VoiceProvider):
    """Retell AI integration.

    Verified against docs.retellai.com (2026-09-22):
    - place_call: POST /v2/create-phone-call — confirmed correct.
    - transfer: Retell has NO REST endpoint for triggering a transfer.
      Transfer is configured as a "Transfer Call Tool" on the Agent in the
      Retell dashboard; the agent decides and executes transfer during the
      live conversation, and Retell automatically forwards the transcript +
      an AI summary (whisper) to the destination. Backend cannot call this.
    - end_call: no documented endpoint found. Unverified — calling this will
      likely 404. Confirm with Retell support before relying on it.
    - webhook payload has no top-level "event_id"; dedup key must be derived
      from call_id + event + timestamp (see parse_webhook).
    """

    def __init__(self, api_key: str, from_number: str, client: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._from_number = from_number
        self._client = client or httpx.Client(
            base_url=RETELL_BASE_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    def place_call(self, phone: str, lang: str, lead_context: dict[str, Any]) -> str:
        response = self._client.post(
            "/v2/create-phone-call",
            json={
                "from_number": self._from_number,
                "to_number": phone,
                "retell_llm_dynamic_variables": {"lang": lang, **lead_context},
            },
        )
        response.raise_for_status()
        return response.json()["call_id"]

    def create_web_call(self, agent_id: str) -> str:
        """Dev/test-only: start a browser-based Retell Web Call.

        POST /v2/create-web-call (confirmed against docs.retellai.com 2026-09-22)
        takes only `agent_id` and returns an `access_token` the frontend uses
        with `retell-client-js-sdk`'s RetellWebClient to open a WebRTC session
        directly from the browser (no phone number involved). Not part of the
        VoiceProvider interface — this is a standalone test utility, not an
        outbound-call operation.
        """
        response = self._client.post(
            "/v2/create-web-call",
            json={"agent_id": agent_id},
        )
        response.raise_for_status()
        return response.json()["access_token"]

    def transfer(self, call_id: str, target: str, context: dict[str, Any]) -> None:
        raise NotImplementedError(
            "Retell has no REST API to trigger a call transfer. Configure a "
            "'Transfer Call Tool' on the Agent in the Retell dashboard instead — "
            "the agent triggers transfer itself during the conversation. Backend "
            "only observes transfer_started/transfer_bridged webhook events."
        )

    def end_call(self, call_id: str) -> None:
        raise NotImplementedError(
            "No documented Retell endpoint to force-end a call was found. "
            "Confirm with Retell support before implementing this."
        )

    # --- Agent config admin methods (phase-03) ---
    # Not part of VoiceProvider interface (same precedent as create_web_call
    # above) — these are admin/config operations, not call operations.
    # Verified against docs.retellai.com (2026-09-24), see
    # plans/20260924-1030-teleapo-dashboard-ui/phase-03-agent-config.md.

    def get_agent(self, agent_id: str) -> dict[str, Any]:
        response = self._client.get(f"/get-agent/{agent_id}")
        response.raise_for_status()
        return response.json()

    def update_agent(self, agent_id: str, fields: dict[str, Any], version: int | None = None) -> dict[str, Any]:
        params = {"version": version} if version is not None else None
        response = self._client.patch(f"/update-agent/{agent_id}", json=fields, params=params)
        response.raise_for_status()
        return response.json()

    def create_agent_version(self, agent_id: str, base_version: int) -> dict[str, Any]:
        """A published agent version is immutable except its version_title
        (PATCH /update-agent 422s "Cannot update published agent other than
        version title" — confirmed via docs.retellai.com 2026-09-24). Editing
        any other field requires cloning a new draft version here first, then
        PATCHing that draft version (see patch_agent_config in agent_config.py)."""
        response = self._client.post(
            f"/create-agent-version/{agent_id}", json={"base_version": base_version}
        )
        response.raise_for_status()
        return response.json()

    def get_llm(self, llm_id: str) -> dict[str, Any]:
        response = self._client.get(f"/get-retell-llm/{llm_id}")
        response.raise_for_status()
        return response.json()

    def update_llm(self, llm_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        response = self._client.patch(f"/update-retell-llm/{llm_id}", json=fields)
        response.raise_for_status()
        return response.json()

    def create_llm(self, fields: dict[str, Any]) -> dict[str, Any]:
        """A published LLM is immutable (PATCH /update-retell-llm returns 400
        "Cannot update published LLM" — confirmed via docs.retellai.com
        2026-09-24). Editing a published agent's prompt requires creating a
        NEW LLM here, then pointing the agent's response_engine.llm_id at it
        (see patch_agent_config in agent_config.py)."""
        response = self._client.post("/create-retell-llm", json=fields)
        response.raise_for_status()
        return response.json()

    def list_voices(self) -> list[dict[str, Any]]:
        response = self._client.get("/list-voices")
        response.raise_for_status()
        return response.json()

    def publish_agent_version(self, agent_id: str, version: int) -> dict[str, Any]:
        response = self._client.post(f"/publish-agent-version/{agent_id}", json={"version": version})
        response.raise_for_status()
        # Retell returns 200 with an empty body on success here (unlike the
        # other endpoints above) — .json() on empty content raises.
        return response.json() if response.content else {}

    def parse_webhook(self, payload: dict[str, Any]) -> WebhookEventData:
        call = payload.get("call", {})
        call_id = call.get("call_id", "")
        event_type = payload["event"]
        # Retell webhooks carry no top-level event_id; derive a stable dedup
        # key from call_id + event + timestamp so idempotent replay still works.
        timestamp = call.get("end_timestamp") or call.get("start_timestamp") or ""
        provider_event_id = f"{call_id}:{event_type}:{timestamp}"

        call_analysis = call.get("call_analysis") or {}
        return WebhookEventData(
            provider_event_id=provider_event_id,
            event_type=event_type,
            call_id=call_id,
            status=call.get("call_status"),
            recording_url=call.get("recording_url"),
            transcript_status="ready" if call.get("transcript") else None,
            intent_confidence=call_analysis.get("intent_confidence"),
        )
