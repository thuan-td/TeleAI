import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Lead
from app.db.session import get_db

router = APIRouter(prefix="/leads", tags=["leads"])


class CreateLeadRequest(BaseModel):
    phone: str
    name: str
    lang: str = "ja"


class LeadResponse(BaseModel):
    id: uuid.UUID
    phone: str
    name: str
    lang: str
    status: str


@router.post("", response_model=LeadResponse, status_code=201)
def create_lead(body: CreateLeadRequest, db: Session = Depends(get_db)) -> LeadResponse:
    lead = Lead(
        organization_id=uuid.uuid4(),
        phone=body.phone,
        name=body.name,
        lang=body.lang,
        status="new",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return LeadResponse(id=lead.id, phone=lead.phone, name=lead.name, lang=lead.lang, status=lead.status)


@router.get("", response_model=list[LeadResponse])
def list_leads(db: Session = Depends(get_db)) -> list[LeadResponse]:
    leads = db.query(Lead).order_by(Lead.created_at.desc()).all()
    return [LeadResponse(id=l.id, phone=l.phone, name=l.name, lang=l.lang, status=l.status) for l in leads]
