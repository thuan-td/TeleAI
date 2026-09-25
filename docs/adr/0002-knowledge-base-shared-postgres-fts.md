# ADR 0002 — Knowledge Base dùng chung cho 2 voice provider, Postgres full-text search thay vì pgvector

**Trạng thái:** Confirmed (2026-09-24, commit `6c2ef7f` + `44ff58c`, branch `feat/mvp-core-initial-setup`)
**Liên quan:** ADR 0001 (voice provider), `backend/app/routers/kb.py`, `backend/app/db/models.py::KnowledgeBaseDocument`, `backend/alembic/versions/c4d8f61a9b02_add_kb_documents.py`

## Bối cảnh

TeleApo Clone hỗ trợ 2 provider cho AI agent: Retell (custom LLM) và OpenAI Realtime (web-call). Cả hai cần tra cứu thông tin ngoài prompt (FAQ, chính sách, sản phẩm...) khi khách hỏi điều agent không được dạy sẵn.

Retell có managed Knowledge Base riêng, nhưng gắn theo từng agent/provider — nếu dùng, nội dung phải nhập trùng 2 nơi (Retell dashboard + một chỗ khác cho OpenAI Realtime) và dễ lệch dữ liệu giữa 2 provider.

## Quyết định

### 1. Một bảng KB dùng chung, app tự quản lý (không dùng Retell managed KB)

`kb_documents` là nguồn dữ liệu duy nhất. Cả Retell (qua custom-function webhook `POST /kb/retell-function-call`) và OpenAI Realtime (qua `POST /kb/query` gọi trực tiếp từ backend khi nhận `response.function_call_arguments.done`) đều đọc từ bảng này. Thêm/sửa/xoá tài liệu chỉ làm 1 chỗ, luôn đồng bộ giữa 2 provider.

### 2. Postgres full-text search (tsvector), KHÔNG dùng pgvector/embeddings

- **Độ trễ ưu tiên hơn độ chính xác ngữ nghĩa**: tra cứu KB diễn ra giữa lúc đang gọi thoại trực tiếp (voice call) — mỗi giây chờ đều lộ ra thành khoảng lặng khó chịu cho người gọi. FTS là truy vấn SQL thuần (GIN index), không tốn round-trip gọi embedding API như pgvector cần.
- **Nội dung KB là FAQ/tài liệu ngắn** (chính sách, sản phẩm, câu trả lời mẫu) — loại nội dung mà khớp từ khoá (lexical match) đã đủ tốt, không cần semantic search để bắt được diễn đạt khác nghĩa giống nhau.
- **Không thêm dependency hạ tầng mới**: pgvector cần cài extension + có thể cần tuning riêng (`ivfflat`/`hnsw`); FTS dùng tính năng lõi có sẵn của Postgres, không đổi hạ tầng.

### Cài đặt kỹ thuật

- Cột `tokens` kiểu `TSVECTOR`, generated column (`Computed`, `persisted=True`) — Postgres tự tính lại khi `title`/`content` đổi, không cần code cập nhật tay và không lệch dữ liệu.
- Trọng số: `setweight(title, 'A') || setweight(content, 'B')` — khớp ở tiêu đề được ưu tiên xếp hạng cao hơn khớp trong nội dung.
- Text search config: `'simple'` (không dùng `'english'` hay dictionary tiếng Việt riêng) — chấp nhận không stemming, ưu tiên đơn giản/dễ đoán hành vi cho giai đoạn MVP.
- Truy vấn qua `websearch_to_tsquery` + `ts_rank`, giới hạn `QUERY_RESULT_LIMIT = 3` kết quả — mirror `top_k` mặc định của Retell managed KB để giữ ngữ cảnh trả cho LLM ngắn gọn.
- Index: GIN trên `tokens` (`ix_kb_documents_tokens`).

## Hệ quả

- **Được**: 1 nguồn dữ liệu, latency thấp, không thêm hạ tầng, dễ hiểu/debug (SQL thuần, không hộp đen embedding).
- **Đánh đổi**: không bắt được truy vấn diễn đạt khác từ nhưng cùng nghĩa (vd. "giá bao nhiêu" vs "chi phí thế nào" nếu không chung từ khoá). Nếu sau này KB phình to hoặc câu hỏi khách đa dạng ngữ nghĩa hơn, cân nhắc bổ sung pgvector song song (không thay thế FTS) — đây là điểm mở, chưa quyết định.
- **Bảo mật đi kèm**: webhook Retell gọi vào (`/kb/retell-function-call`) là endpoint public (Retell gọi qua domain/tunnel, không phải localhost) — bắt buộc xác thực bằng header `X-KB-Webhook-Secret` so với `settings.kb_webhook_secret`, khác với `retell_webhook_secret` đã có (secret đó bảo vệ *event* webhook, secret mới bảo vệ *custom-function* webhook — 2 tính năng Retell khác nhau, không dùng chung secret). Thiếu `APP_PUBLIC_URL`/`KB_WEBHOOK_SECRET` trong `.env` → bật `knowledge_base_enabled` sẽ bị chặn ở tầng API (422) thay vì tạo ra webhook không có xác thực.
