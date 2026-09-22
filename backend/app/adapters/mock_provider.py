import uuid
from typing import Any

from app.adapters.voice_provider import VoiceProvider, WebhookEventData


class MockVoiceProvider(VoiceProvider):
    """In-memory fake used by unit/integration tests — no network calls."""

    def __init__(self) -> None:
        self.calls: dict[str, dict[str, Any]] = {}
        self.transfers: list[tuple[str, str, dict[str, Any]]] = []

    def place_call(self, phone: str, lang: str, lead_context: dict[str, Any]) -> str:
        call_id = f"mock-{uuid.uuid4()}"
        self.calls[call_id] = {"phone": phone, "lang": lang, "context": lead_context}
        return call_id

    def transfer(self, call_id: str, target: str, context: dict[str, Any]) -> None:
        self.transfers.append((call_id, target, context))

    def end_call(self, call_id: str) -> None:
        self.calls.pop(call_id, None)

    def parse_webhook(self, payload: dict[str, Any]) -> WebhookEventData:
        """Mirrors RetellAdapter.parse_webhook so tests exercise the real payload shape."""
        call = payload.get("call", {})
        call_id = call.get("call_id", "")
        event_type = payload["event"]
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
