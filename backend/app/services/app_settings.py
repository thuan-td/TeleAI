import logging

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import AppSetting
from app.core.clock import utcnow

logger = logging.getLogger(__name__)

INTENT_THRESHOLD_KEY = "intent_confidence_threshold"
OPENAI_LANGUAGE_KEY = "openai_realtime_language"
OPENAI_PROMPT_KEY = "openai_realtime_prompt"
OPENAI_VOICE_KEY = "openai_realtime_voice"

DEFAULT_OPENAI_LANGUAGE = "ja"
DEFAULT_OPENAI_PROMPT = ""
DEFAULT_OPENAI_VOICE = "marin"

OPENAI_LANGUAGE_NAMES = {"vi": "Vietnamese", "ja": "Japanese", "en": "English"}
OPENAI_VOICES = {"alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"}


def _get_setting(db: Session, key: str, default: str) -> str:
    row = db.get(AppSetting, key)
    if row is None:
        return default
    return row.value


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value=value, updated_at=utcnow())
        db.add(row)
    else:
        row.value = value
        row.updated_at = utcnow()
    db.commit()


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
    _set_setting(db, INTENT_THRESHOLD_KEY, str(value))


def get_openai_language(db: Session) -> str:
    """Language for OpenAI Realtime tester's spoken responses. OpenAI Realtime
    has no dedicated output-language field (confirmed via docs research) —
    this is steered through `instructions` text built in web_calls.py."""
    value = _get_setting(db, OPENAI_LANGUAGE_KEY, DEFAULT_OPENAI_LANGUAGE)
    return value if value in OPENAI_LANGUAGE_NAMES else DEFAULT_OPENAI_LANGUAGE


def set_openai_language(db: Session, value: str) -> None:
    _set_setting(db, OPENAI_LANGUAGE_KEY, value)


def get_openai_prompt(db: Session) -> str:
    """User-authored instructions for the OpenAI Realtime tester, prepended
    to the auto-generated language directive in web_calls.py."""
    return _get_setting(db, OPENAI_PROMPT_KEY, DEFAULT_OPENAI_PROMPT)


def set_openai_prompt(db: Session, value: str) -> None:
    _set_setting(db, OPENAI_PROMPT_KEY, value)


def get_openai_voice(db: Session) -> str:
    """OpenAI Realtime voice (one of OPENAI_VOICES). Falls back to the
    default if the stored value is no longer a valid voice (e.g. OpenAI
    deprecates one)."""
    value = _get_setting(db, OPENAI_VOICE_KEY, DEFAULT_OPENAI_VOICE)
    return value if value in OPENAI_VOICES else DEFAULT_OPENAI_VOICE


def set_openai_voice(db: Session, value: str) -> None:
    _set_setting(db, OPENAI_VOICE_KEY, value)
