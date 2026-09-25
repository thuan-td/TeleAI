# System Architecture — TeleApo Clone

> Tài liệu này tập trung vào các mảng kiến trúc mới/đáng chú ý. Quyết định thiết kế chi tiết + lý do nằm ở `docs/adr/`.

## Tổng quan

- **Backend**: FastAPI (Python), Postgres (SQLAlchemy + Alembic migration), routers theo domain (`leads`, `calls`, `agent_config`, `kb`, `web_calls`, `webhooks`).
- **Frontend**: React + Vite + Tailwind CSS, gọi backend qua `frontend/src/api/*.ts`.
- **Voice provider**: 2 provider song song — Retell (custom LLM, outbound call) và OpenAI Realtime (web-call tester, browser-based). Xem `docs/adr/0001-voice-provider.md` cho quyết định về transfer-call.

## Knowledge Base (dùng chung cho cả 2 voice provider)

**Quyết định kiến trúc**: xem `docs/adr/0002-knowledge-base-shared-postgres-fts.md` (1 KB dùng chung + Postgres full-text search thay vì pgvector).

### Schema

Bảng `kb_documents` (migration `c4d8f61a9b02_add_kb_documents.py`):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | UUID, PK | `default=uuid.uuid4` |
| `title` | VARCHAR(200) | |
| `content` | TEXT | |
| `tokens` | TSVECTOR | **Generated column** — Postgres tự tính từ `title`/`content`, không ghi tay |
| `created_at` | TIMESTAMPTZ | |

Index: GIN trên `tokens` (`ix_kb_documents_tokens`).

### Luồng dữ liệu

```
Admin (frontend AgentConfigPage)
  ├─ tạo/xem/xoá document thủ công  → POST/GET/DELETE /kb/documents
  └─ upload file (PDF/DOCX/ảnh)     → POST /kb/documents/upload
                                          │
                                          ▼
                                    kb_documents (Postgres, tokens auto-generated)
                                          ▲
                    ┌─────────────────────┴─────────────────────┐
                    │                                           │
         Retell (custom function call)              OpenAI Realtime (browser tool call)
         POST /kb/retell-function-call               backend gọi POST /kb/query
         (xác thực X-KB-Webhook-Secret)               (nội bộ, cùng process, không qua HTTP public)
```

### API contract (router `backend/app/routers/kb.py`, prefix `/kb`)

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/kb/documents` | List toàn bộ document, sort `created_at desc` | nội bộ (frontend) |
| POST | `/kb/documents` | Tạo document thủ công — body `{title, content}` | nội bộ |
| POST | `/kb/documents/upload` | Upload nhiều file 1 request (`files: list[UploadFile]`) — mỗi file thành công/lỗi độc lập, response `{results: [{filename, success, document?, error?}]}` | nội bộ |
| DELETE | `/kb/documents/{document_id}` | Xoá 1 document, 404 nếu không tồn tại | nội bộ |
| POST | `/kb/query` | Full-text search, trả về top 3 kết quả xếp hạng theo `ts_rank`. Gọi bởi backend khi xử lý OpenAI Realtime function call | nội bộ |
| POST | `/kb/retell-function-call` | Webhook Retell gọi vào khi agent quyết định tra KB. Body theo format Retell custom-function: `{name, args: {query}}` | **header `X-KB-Webhook-Secret` bắt buộc**, so khớp `settings.kb_webhook_secret` — sai/thiếu → 401 |

Giới hạn upload: 5MB/file, chỉ nhận `.pdf`, `.docx`, `.jpg`, `.jpeg`, `.png` — file khác định dạng hoặc quá dung lượng trả lỗi trong `results[].error`, không làm fail cả batch.

Trích xuất nội dung theo định dạng:
- **PDF** → `pypdf` (`PdfReader.extract_text()` từng trang, nối `\n\n`)
- **DOCX** → `python-docx` (nối text từng paragraph)
- **JPG/PNG** → Tesseract OCR (`pytesseract`, `lang="vie+eng"`), chạy async trong threadpool của FastAPI (không block event loop) — image → PIL → OCR

### Bật/tắt KB cho Retell agent

`PATCH /agent/config` với `knowledge_base_enabled: true/false` (router `agent_config.py`):
- Bật: thêm 1 entry vào `general_tools` của Retell LLM — tool `type: "custom"`, `name: "query_knowledge_base"`, `url: {APP_PUBLIC_URL}/kb/retell-function-call`, header `X-KB-Webhook-Secret` set từ `settings.kb_webhook_secret`.
- Tắt: lọc bỏ tool có `name == "query_knowledge_base"` khỏi `general_tools`.
- Thiếu `APP_PUBLIC_URL` hoặc `KB_WEBHOOK_SECRET` trong `.env` → request bật KB trả 422, không tạo tool "hở" (không xác thực).
- `GET /agent/config` trả `knowledge_base_enabled` (suy ra từ việc tool có mặt trong `general_tools` của Retell LLM hiện tại hay không) để frontend hiển thị đúng trạng thái.

### Biến môi trường mới (`.env`, đọc qua `backend/app/core/config.py::Settings`)

| Biến | Mô tả |
|---|---|
| `APP_PUBLIC_URL` | URL public backend, để Retell gọi ngược vào webhook KB. Retell từ chối `localhost` — dev cần tunnel (ngrok/cloudflared), prod cần domain thật. |
| `KB_WEBHOOK_SECRET` | Secret dùng cho header `X-KB-Webhook-Secret`, xác thực webhook `/kb/retell-function-call`. Khác `RETELL_WEBHOOK_SECRET` (secret cũ bảo vệ event webhook, không dùng chung). |

## Model picker (Retell + OpenAI Realtime)

Cả 2 provider giờ cho chọn model qua UI thay vì hard-code, verify **trực tiếp qua API thật** (không chỉ dựa docs — docs có thể lệch enum thật của provider):

- **Retell**: `RETELL_MODELS` (`backend/app/routers/agent_config.py`) — set các model hợp lệ cho field `model` của Retell LLM, lấy từ lỗi validation 400 của `PATCH /update-retell-llm` khi gửi model không hợp lệ (`request/body/model must be equal to one of the allowed values: ...`). Không gồm `s2s_model` (speech-to-speech, cơ chế khác, ngoài phạm vi UI hiện tại).
- **OpenAI Realtime**: `OPENAI_REALTIME_MODELS` (`backend/app/services/app_settings.py`) — verify qua `GET https://api.openai.com/v1/models`, lọc các model chứa `"realtime"` dùng được làm `model` top-level của Realtime session (loại `gpt-audio-*` không phải Realtime session model, loại `gpt-realtime-translate`/`whisper` vì là model chuyên biệt 1 tác vụ).
- Field mới trong `AgentConfigResponse`/`AgentConfigUpdate`: `model` (Retell), `openai_realtime_model` (OpenAI). Validate ở tầng API — giá trị ngoài set cho phép → 422 kèm danh sách hợp lệ trong `detail`.
- `get_openai_model()`/`set_openai_model()` lưu trong bảng `app_settings` hiện có (key `openai_realtime_model`), theo đúng pattern của `openai_realtime_voice`/`openai_realtime_language` đã có từ trước — không thêm bảng mới.

## Deploy / hạ tầng liên quan

- `backend/Dockerfile` cài thêm `tesseract-ocr` + `tesseract-ocr-vie` (apt) để OCR chạy được trong container — dev local cần cài tương đương (`brew install tesseract-lang` hoặc distro package tương ứng).
- `backend/requirements.txt` thêm: `python-multipart` (multipart upload), `pypdf`, `python-docx`, `pytesseract`, `Pillow` (xử lý file KB), `fpdf2` (tạo PDF — dùng trong test).
