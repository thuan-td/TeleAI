from datetime import datetime, time, timezone

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.db.models import CallRecord, Lead
from app.schemas.calls import CallFilters


def build_call_query(db: Session, filters: CallFilters) -> Select:
    """Query joining CallRecord + Lead with every filter applied. Shared by
    GET /calls and GET /calls/export so filter logic never drifts apart."""
    query = select(CallRecord, Lead.name, Lead.phone).join(Lead, CallRecord.lead_id == Lead.id)

    if filters.status:
        query = query.where(CallRecord.status == filters.status)
    if filters.lead_id:
        query = query.where(CallRecord.lead_id == filters.lead_id)
    if filters.date_from:
        query = query.where(
            CallRecord.created_at >= datetime.combine(filters.date_from, time.min, tzinfo=timezone.utc)
        )
    if filters.date_to:
        query = query.where(
            CallRecord.created_at <= datetime.combine(filters.date_to, time.max, tzinfo=timezone.utc)
        )
    if filters.q:
        pattern = f"%{filters.q}%"
        query = query.where(or_(CallRecord.call_id.ilike(pattern), Lead.name.ilike(pattern), Lead.phone.ilike(pattern)))

    return query
