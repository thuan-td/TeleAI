# Phase 02 — Bọc auth quanh router

## Context Links

- Overview: [plan.md](plan.md) §5 (ma trận phân quyền)
- Phụ thuộc: [phase-01](phase-01-backend-auth-core.md)
- File trục: `backend/app/main.py` (hiện 26 dòng)

## Overview

- **Ưu tiên:** P0 · **Trạng thái:** 📋 TODO
- Bật enforce. **Toàn bộ thay đổi tập trung ở `main.py` + tách 2 router có endpoint hỗn hợp.** Không sửa thân bất kỳ handler nghiệp vụ nào ⇒ tôn trọng ràng buộc "không đụng 3 phase DONE".

## Key Insights (đã verify trong code)

1. **`/calls` do 2 router cùng phục vụ**: `calls.py` (`prefix="/calls"`) và `web_calls.py` (`prefix="/calls"`, các path `/web`, `/web/openai`). Vì là 2 `APIRouter` riêng ⇒ **gắn dependency khác nhau cho từng router được**, không cần tách file. May mắn: `web_calls` toàn bộ là dev tool ⇒ cả router admin-only.
2. **`calls.py` hỗn hợp quyền**: `GET /calls/export` phải admin, còn lại user thường. ⇒ router-level `require_user` + thêm `Depends(require_admin)` riêng cho `export` **trong decorator** (`@router.get("/export", dependencies=[Depends(require_admin)])`) — đụng đúng 1 dòng decorator, **không** sửa thân hàm.
3. **`kb.py` hỗn hợp nghiêm trọng**: `POST /kb/retell-function-call` do Retell gọi từ internet, **không có cookie** ⇒ tuyệt đối không được gắn `require_user` ở router-level, nếu không KB agent gãy ngay. Vì các endpoint còn lại của `kb.py` đều admin-only, giải pháp: gắn `require_admin` **ở từng decorator** của 5 endpoint còn lại, để `retell-function-call` nguyên vẹn.
4. `webhooks.py` — toàn bộ là webhook Retell ⇒ **không gắn gì**, giữ `X-Webhook-Secret`.
5. `GET /calls/{call_id}` khai **sau** `GET /calls/export` trong file (dòng 105 vs 134) ⇒ thứ tự route đúng, không lo `export` bị nuốt thành `call_id`. Đừng đảo.

## Ma trận thực thi

| Router | Cách gắn | Quyền |
|---|---|---|
| `leads.router` | `include_router(..., dependencies=[Depends(require_user)])` | user |
| `calls.router` | `include_router(..., dependencies=[Depends(require_user)])` + decorator `require_admin` trên `/export` | user, export=admin |
| `web_calls.router` | `include_router(..., dependencies=[Depends(require_admin)])` | admin |
| `agent_config.router` | `include_router(..., dependencies=[Depends(require_admin)])` | admin |
| `kb.router` | **KHÔNG** gắn ở include_router; gắn `dependencies=[Depends(require_admin)]` vào 5 decorator | admin, trừ webhook |
| `webhooks.router` | không gắn | secret header (giữ nguyên) |
| `auth.router` | không gắn | `/me`,`/logout` tự có `Depends(get_current_user)` |
| `GET /health` | không gắn | public |

## Related Code Files

**Sửa**
- `backend/app/main.py` — thêm `dependencies=[...]` vào 5 lời gọi `include_router`
- `backend/app/routers/calls.py` — **chỉ dòng decorator** `@router.get("/export")` → thêm `dependencies=[Depends(require_admin)]`
- `backend/app/routers/kb.py` — **chỉ 5 dòng decorator** (`list_documents`, `create_document`, `upload_documents`, `delete_document`, `query`); **KHÔNG** đụng `retell_query_knowledge_base`

**Không tạo file mới.**

## Implementation Steps

1. `main.py`: `from app.auth import require_admin, require_user`, thêm `dependencies=` theo bảng trên.
2. `calls.py`: import `require_admin`, sửa decorator `/export`. Không đụng thân hàm, không đổi signature.
3. `kb.py`: import `require_admin`, thêm `dependencies=[Depends(require_admin)]` vào đúng 5 decorator. Ghi comment 1 dòng ngay trên `retell-function-call` giải thích **vì sao** nó không có dependency (để người sau không "sửa cho đồng bộ").
4. Kiểm tay: `uvicorn` chạy, `curl /leads` không cookie → 401; `curl /health` → 200; `curl -H 'X-KB-Webhook-Secret: ...' -X POST /kb/retell-function-call` → 200 (không cần cookie).
5. Kiểm `GET /openapi.json` — mọi path trừ `/health`, `/auth/login`, `/webhooks/retell`, `/kb/retell-function-call` đều phải có security dependency (test tự động ở phase 03).

## Todo List

- [ ] `main.py`: gắn `require_user` cho `leads`, `calls`
- [ ] `main.py`: gắn `require_admin` cho `web_calls`, `agent_config`
- [ ] `calls.py`: `/export` thêm `require_admin` (chỉ decorator)
- [ ] `kb.py`: 5 decorator thêm `require_admin` + comment miễn trừ cho webhook
- [ ] Xác nhận `webhooks.py` **không** bị chạm (git diff phải trống)
- [ ] Smoke test bằng curl 4 ca ở bước 4

## Success Criteria

- Không cookie: `GET /leads`, `GET /calls`, `GET /agent/config`, `GET /kb/documents` → **401**.
- Cookie viewer: `GET /leads` → 200; `GET /calls/export` → **403**; `PATCH /agent/config` → **403**; `POST /calls/web` → **403**.
- Cookie admin: tất cả trên → 200 (hoặc 503 do thiếu Retell key, chấp nhận — không phải 401/403).
- `POST /webhooks/retell` + `POST /kb/retell-function-call` với secret đúng, **không cookie** → vẫn 200.
- `GET /health` không cookie → 200.
- `git diff backend/app/routers/webhooks.py` → rỗng. `git diff backend/app/routers/{leads,agent_config,web_calls}.py` → rỗng.
- `git diff backend/app/routers/calls.py` và `kb.py` → **chỉ** dòng import + dòng decorator (không dòng nào trong thân hàm).

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Lỡ gắn auth lên `retell-function-call` → agent KB chết lặng khi đang gọi khách | Không gắn ở router-level cho `kb`; test khẳng định endpoint này 200 **không cookie**; comment cảnh báo tại chỗ |
| Endpoint mới thêm sau quên auth | Router-level là mặc định-đóng cho 4/5 router; `kb.py` là ngoại lệ duy nhất ⇒ test "liệt kê route" ở phase 03 bắt được |
| `/export` bị match nhầm bởi `/{call_id}` | Thứ tự khai hiện tại đã đúng; thêm test `GET /calls/export` bằng cookie viewer phải là 403 **chứ không phải 404/200** |
| 503 do thiếu Retell key bị nhầm là lỗi auth | Ghi rõ trong success criteria; test dùng `get_retell_admin_client` override |

## Security Considerations

- Mặc định-đóng ở tầng `include_router`: quên là **chặn**, không phải mở.
- `kb.py` là ngoại lệ có chủ ý, đã ghi lý do tại chỗ — đây là điểm yếu duy nhất về mặt "quên", được bù bằng test liệt kê route.
- 403 (đã đăng nhập, không đủ quyền) tách bạch 401 (chưa đăng nhập) để FE xử lý đúng: 401 → đá về `/login`, 403 → báo "không đủ quyền", **không** đá ra login (tránh vòng lặp đăng nhập).

## Next Steps

→ [phase-03-test-fixtures.md](phase-03-test-fixtures.md) và [phase-04-frontend-login.md](phase-04-frontend-login.md) (song song).
