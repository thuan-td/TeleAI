import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import DEFAULT_ORG_ID
from app.db.models import CallRecord, Lead
from app.db.session import get_db
from app.schemas.leads import (
    CreateLeadRequest,
    LeadDetailResponse,
    LeadResponse,
    PaginatedLeads,
    UpdateLeadRequest,
)

router = APIRouter(prefix="/leads", tags=["leads"])


def _active_leads(db: Session):
    """Base query for leads that have not been soft-deleted. Reuse everywhere."""
    return select(Lead).where(Lead.deleted_at.is_(None))


def _get_active_lead(db: Session, lead_id: uuid.UUID) -> Lead:
    lead = db.scalar(_active_leads(db).where(Lead.id == lead_id))
    if lead is None:
        raise HTTPException(status_code=404, detail="lead not found")
    return lead


@router.post("", response_model=LeadResponse, status_code=201)
def create_lead(body: CreateLeadRequest, db: Session = Depends(get_db)) -> Lead:
    lead = Lead(
        organization_id=DEFAULT_ORG_ID,
        phone=body.phone,
        name=body.name,
        lang=body.lang,
        status="new",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("", response_model=PaginatedLeads)
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = None,
    status: str | None = None,
    lang: str | None = None,
    db: Session = Depends(get_db),
) -> PaginatedLeads:
    query = _active_leads(db)

    if q:
        query = query.where(or_(Lead.name.ilike(f"%{q}%"), Lead.phone.ilike(f"%{q}%")))
    if status:
        query = query.where(Lead.status == status)
    if lang:
        query = query.where(Lead.lang == lang)

    total = db.scalar(select(func.count()).select_from(query.subquery()))

    items = db.scalars(
        query.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()

    return PaginatedLeads(items=list(items), total=total or 0, page=page, page_size=page_size)


@router.get("/{lead_id}", response_model=LeadDetailResponse)
def get_lead(lead_id: uuid.UUID, db: Session = Depends(get_db)) -> LeadDetailResponse:
    lead = _get_active_lead(db, lead_id)

    call_count, last_call_at = db.execute(
        select(func.count(CallRecord.id), func.max(CallRecord.started_at)).where(
            CallRecord.lead_id == lead_id
        )
    ).one()

    return LeadDetailResponse(
        id=lead.id,
        phone=lead.phone,
        name=lead.name,
        lang=lead.lang,
        status=lead.status,
        created_at=lead.created_at,
        updated_at=lead.updated_at,
        call_count=call_count or 0,
        last_call_at=last_call_at,
    )


@router.patch("/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: uuid.UUID, body: UpdateLeadRequest, db: Session = Depends(get_db)) -> Lead:
    lead = _get_active_lead(db, lead_id)

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(lead, field, value)

    if updates:
        lead.updated_at = utcnow()

    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    lead = _get_active_lead(db, lead_id)
    lead.deleted_at = utcnow()
    db.commit()
