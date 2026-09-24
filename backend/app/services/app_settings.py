import logging

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import AppSetting
from app.core.clock import utcnow

logger = logging.getLogger(__name__)

INTENT_THRESHOLD_KEY = "intent_confidence_threshold"
OPENAI_LANGUAGE_KEY = "openai_realtime_language"
DEFAULT_OPENAI_LANGUAGE = "ja"

OPENAI_LANGUAGE_NAMES = {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}


def get_intent_threshold(db: Session, settings: Settings) -> float:
    """Read intent_confidence_threshold from app_settings; fall back to the
    env-configured default when no row exists yet or the stored value is
    unparseable (keeps behavior backward-compatible, see phase-03 plan)."""
    row = db.get(AppSetting, INTENT_THRESHOLD_KEY)
    if row is None:
        return settings.intent_confidence_threshold
    try:
        return float(row.value)
    except (TypeError, ValueError):
        logger.warning(
            "app_settings row %s has unparseable value %r, falling back to env default",
            INTENT_THRESHOLD_KEY,
            row.value,
        )
        return settings.intent_confidence_threshold


def set_intent_threshold(db: Session, value: float) -> None:
    row = db.get(AppSetting, INTENT_THRESHOLD_KEY)
    if row is None:
        row = AppSetting(key=INTENT_THRESHOLD_KEY, value=str(value), updated_at=utcnow())
        db.add(row)
    else:
        row.value = str(value)
        row.updated_at = utcnow()
    db.commit()


def get_openai_language(db: Session) -> str:
    """Language for OpenAI Realtime tester's spoken responses. OpenAI Realtime
    has no dedicated output-language field (confirmed via docs research) —
    this is steered through `instructions` text built in web_calls.py."""
    row = db.get(AppSetting, OPENAI_LANGUAGE_KEY)
    if row is None or row.value not in OPENAI_LANGUAGE_NAMES:
        return DEFAULT_OPENAI_LANGUAGE
    return row.value


def set_openai_language(db: Session, value: str) -> None:
    row = db.get(AppSetting, OPENAI_LANGUAGE_KEY)
    if row is None:
        row = AppSetting(key=OPENAI_LANGUAGE_KEY, value=value, updated_at=utcnow())
        db.add(row)
    else:
        row.value = value
        row.updated_at = utcnow()
    db.commit()
