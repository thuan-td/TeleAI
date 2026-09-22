from abc import ABC, abstractmethod
from typing import Any


class VoiceProvider(ABC):
    @abstractmethod
    def place_call(self, phone: str, lang: str, lead_context: dict[str, Any]) -> str:
        """Dial outbound call, return provider call_id."""

    @abstractmethod
    def transfer(self, call_id: str, target: str, context: dict[str, Any]) -> None:
        """Warm-transfer an in-progress call to target, sending context first."""

    @abstractmethod
    def end_call(self, call_id: str) -> None:
        """Force-end an in-progress call."""

    @abstractmethod
    def parse_webhook(self, payload: dict[str, Any]) -> "WebhookEventData":
        """Parse raw provider webhook payload into a normalized event."""


class WebhookEventData:
    def __init__(
        self,
        provider_event_id: str,
        event_type: str,
        call_id: str,
        status: str | None = None,
        recording_url: str | None = None,
        transcript_status: str | None = None,
        intent_confidence: float | None = None,
    ) -> None:
        self.provider_event_id = provider_event_id
        self.event_type = event_type
        self.call_id = call_id
        self.status = status
        self.recording_url = recording_url
        self.transcript_status = transcript_status
        self.intent_confidence = intent_confidence
