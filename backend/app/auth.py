import uuid

from fastapi import Depends, HTTPException, Request
from itsdangerous import BadSignature, SignatureExpired
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import SESSION_COOKIE_NAME, get_serializer
from app.db.models import User
from app.db.session import get_db

UNAUTHENTICATED_DETAIL = "Chưa đăng nhập"


class CurrentUser(BaseModel):
    id: uuid.UUID
    username: str
    role: str


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token is None:
        raise HTTPException(status_code=401, detail=UNAUTHENTICATED_DETAIL)

    try:
        payload = get_serializer(settings).loads(token, max_age=settings.session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail=UNAUTHENTICATED_DETAIL)

    user = db.get(User, uuid.UUID(payload["uid"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail=UNAUTHENTICATED_DETAIL)

    return CurrentUser(id=user.id, username=user.username, role=user.role)


require_user = Depends(get_current_user)


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Cần quyền admin")
    return user
