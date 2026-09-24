import csv
import io
from typing import Iterable

from app.db.models import CallRecord

CSV_HEADER = [
    "call_id",
    "lead_name",
    "lead_phone",
    "status",
    "started_at",
    "ended_at",
    "duration_seconds",
    "transfer_result",
    "intent_confidence",
    "retry_count",
    "recording_url",
]


def stream_calls_csv(rows: Iterable[tuple[CallRecord, str, str]]):
    """Yield CSV chunks (UTF-8 BOM + csv.writer escaping) for /calls/export.
    Kept separate from the router so StreamingResponse generator logic isn't
    tangled with request/response wiring."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    buffer.write("﻿")
    writer.writerow(CSV_HEADER)
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)

    for record, lead_name, lead_phone in rows:
        duration_seconds = ""
        if record.started_at and record.ended_at:
            duration_seconds = int((record.ended_at - record.started_at).total_seconds())
        writer.writerow(
            [
                record.call_id,
                lead_name,
                lead_phone,
                record.status,
                record.started_at.isoformat() if record.started_at else "",
                record.ended_at.isoformat() if record.ended_at else "",
                duration_seconds,
                record.transfer_result or "",
                record.intent_confidence if record.intent_confidence is not None else "",
                record.retry_count,
                record.recording_url or "",
            ]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
