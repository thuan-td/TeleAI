import hmac
import io
import logging
import os
import uuid

import pypdf
import pytesseract
from docx import Document as DocxDocument
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_admin
from app.core.config import Settings, get_settings
from app.db.models import KnowledgeBaseDocument
from app.db.session import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/kb", tags=["knowledge-base"])

# Top-N chunks returned per query — mirrors Retell managed-KB's `top_k` default
# (see phase research 2026-09-24) to keep voice-call latency low and context short.
QUERY_RESULT_LIMIT = 3

UPLOAD_MAX_BYTES = 5 * 1024 * 1024  # 5MB — internal admin tool, not a public upload surface
UPLOAD_TEXT_EXTENSIONS = {".pdf", ".docx"}
UPLOAD_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
UPLOAD_EXTENSIONS = UPLOAD_TEXT_EXTENSIONS | UPLOAD_IMAGE_EXTENSIONS
# Vietnamese + English trained data — matches tesseract-ocr-vie installed in
# the Docker image (see backend/Dockerfile). Local dev needs the same
# language pack installed via `brew install tesseract-lang` or equivalent.
OCR_LANGUAGES = "vie+eng"


class KnowledgeBaseDocumentCreate(BaseModel):
    title: str = Field(..., max_length=200)
    content: str = Field(..., min_length=1)


class KnowledgeBaseDocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    content: str


class KnowledgeBaseQueryRequest(BaseModel):
    query: str = Field(..., min_length=1)


class KnowledgeBaseQueryResult(BaseModel):
    title: str
    content: str


class KnowledgeBaseQueryResponse(BaseModel):
    results: list[KnowledgeBaseQueryResult]


@router.get("/documents", response_model=list[KnowledgeBaseDocumentResponse], dependencies=[Depends(require_admin)])
def list_documents(db: Session = Depends(get_db)) -> list[KnowledgeBaseDocumentResponse]:
    documents = db.execute(
        select(KnowledgeBaseDocument).order_by(KnowledgeBaseDocument.created_at.desc())
    ).scalars().all()
    return [
        KnowledgeBaseDocumentResponse(id=doc.id, title=doc.title, content=doc.content) for doc in documents
    ]


@router.post(
    "/documents", response_model=KnowledgeBaseDocumentResponse, status_code=201, dependencies=[Depends(require_admin)]
)
def create_document(
    body: KnowledgeBaseDocumentCreate, db: Session = Depends(get_db)
) -> KnowledgeBaseDocumentResponse:
    document = KnowledgeBaseDocument(title=body.title, content=body.content)
    db.add(document)
    db.commit()
    db.refresh(document)
    return KnowledgeBaseDocumentResponse(id=document.id, title=document.title, content=document.content)


def _extract_text(filename: str, raw: bytes) -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        reader = pypdf.PdfReader(io.BytesIO(raw))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if ext == ".docx":
        document = DocxDocument(io.BytesIO(raw))
        return "\n\n".join(p.text for p in document.paragraphs if p.text.strip()).strip()
    if ext in UPLOAD_IMAGE_EXTENSIONS:
        image = Image.open(io.BytesIO(raw))
        return pytesseract.image_to_string(image, lang=OCR_LANGUAGES).strip()
    raise HTTPException(status_code=422, detail=f"Định dạng file không hỗ trợ: {ext}")


class UploadResult(BaseModel):
    filename: str
    success: bool
    document: KnowledgeBaseDocumentResponse | None = None
    error: str | None = None


class UploadDocumentsResponse(BaseModel):
    results: list[UploadResult]


async def _process_upload(file: UploadFile, db: Session) -> UploadResult:
    if not file.filename:
        return UploadResult(filename="", success=False, error="Thiếu tên file")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in UPLOAD_EXTENSIONS:
        return UploadResult(
            filename=file.filename,
            success=False,
            error=f"Định dạng không hỗ trợ (chỉ nhận {', '.join(sorted(UPLOAD_EXTENSIONS))})",
        )

    raw = await file.read()
    if len(raw) > UPLOAD_MAX_BYTES:
        return UploadResult(
            filename=file.filename,
            success=False,
            error=f"File vượt quá giới hạn {UPLOAD_MAX_BYTES // (1024 * 1024)}MB",
        )

    try:
        content = await run_in_threadpool(_extract_text, file.filename, raw)
    except HTTPException:
        raise
    except Exception:
        logger.exception("kb upload: failed to extract text from %s", file.filename)
        return UploadResult(filename=file.filename, success=False, error="Không đọc được nội dung file")

    if not content:
        return UploadResult(filename=file.filename, success=False, error="Không trích xuất được nội dung text")

    title = os.path.splitext(file.filename)[0][:200]
    document = KnowledgeBaseDocument(title=title, content=content)
    db.add(document)
    db.commit()
    db.refresh(document)
    return UploadResult(
        filename=file.filename,
        success=True,
        document=KnowledgeBaseDocumentResponse(id=document.id, title=document.title, content=document.content),
    )


@router.post(
    "/documents/upload",
    response_model=UploadDocumentsResponse,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
async def upload_documents(
    files: list[UploadFile], db: Session = Depends(get_db)
) -> UploadDocumentsResponse:
    """Accepts multiple files in one request (PDF/DOCX text extraction,
    JPG/PNG via Tesseract OCR — see OCR_LANGUAGES). Each file succeeds or
    fails independently so one bad file in a batch doesn't block the rest."""
    results = [await _process_upload(file, db) for file in files]
    return UploadDocumentsResponse(results=results)


@router.delete("/documents/{document_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_document(document_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    document = db.get(KnowledgeBaseDocument, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy document")
    db.delete(document)
    db.commit()


def _search(db: Session, query_text: str) -> list[KnowledgeBaseQueryResult]:
    tsquery = func.websearch_to_tsquery("simple", query_text)
    rank = func.ts_rank(KnowledgeBaseDocument.tokens, tsquery)
    rows = db.execute(
        select(KnowledgeBaseDocument)
        .where(KnowledgeBaseDocument.tokens.op("@@")(tsquery))
        .order_by(rank.desc())
        .limit(QUERY_RESULT_LIMIT)
    ).scalars().all()
    return [KnowledgeBaseQueryResult(title=row.title, content=row.content) for row in rows]


@router.post("/query", response_model=KnowledgeBaseQueryResponse, dependencies=[Depends(require_admin)])
def query_documents(
    body: KnowledgeBaseQueryRequest, db: Session = Depends(get_db)
) -> KnowledgeBaseQueryResponse:
    """Shared retrieval endpoint called by BOTH voice providers:
    - Retell: as the `query_knowledge_base` custom function webhook (request
      body wrapped as {"name", "args": {"query": ...}, "call": {...}} — see
      _extract_retell_query below for the adapter shim).
    - OpenAI Realtime: called directly by the backend after receiving a
      response.function_call_arguments.done event from the browser."""
    return KnowledgeBaseQueryResponse(results=_search(db, body.query))


class RetellFunctionCallRequest(BaseModel):
    """Retell's custom-function webhook payload shape (verified against
    docs.retellai.com/integrate-llm/integrate-function-calling, 2026-09-24):
    {"name": "...", "args": {...}, "call": {...}}. Retell reads back
    `response_variables` from the JSON keys we return."""

    name: str
    args: dict


# INTENTIONALLY NO require_admin HERE (unlike every other route in this file):
# Retell calls this from the public internet with no session cookie — it
# authenticates via X-KB-Webhook-Secret instead (checked in the body below).
# Adding cookie-auth here would break the live KB lookup mid-call. See
# phase-02-router-protection.md Key Insight #3 before "fixing" this for
# consistency.
@router.post("/retell-function-call", response_model=KnowledgeBaseQueryResponse)
def retell_query_knowledge_base(
    body: RetellFunctionCallRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_kb_webhook_secret: str | None = Header(default=None),
) -> KnowledgeBaseQueryResponse:
    # This URL is reachable from the public internet (Retell calls it through
    # a tunnel/domain, not localhost) — unlike /kb/query and /kb/documents
    # which are only ever called from this app's own frontend. The shared
    # secret is configured as a custom header on the Retell tool definition
    # (see _knowledge_base_tool() in agent_config.py) and echoed back here on
    # every call; without this check anyone who learns the URL could read the
    # entire knowledge base (code review finding, 2026-09-24).
    if x_kb_webhook_secret is None or not hmac.compare_digest(x_kb_webhook_secret, settings.kb_webhook_secret):
        raise HTTPException(status_code=401, detail="invalid webhook secret")

    query_text = body.args.get("query", "")
    if not query_text:
        raise HTTPException(status_code=422, detail="args.query bắt buộc")
    return KnowledgeBaseQueryResponse(results=_search(db, query_text))
