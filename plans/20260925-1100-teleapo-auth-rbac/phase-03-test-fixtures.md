# Phase 03 — Sửa test hiện có + test auth

## Context Links

- Overview: [plan.md](plan.md) §8 Q4
- Phụ thuộc: [phase-02](phase-02-router-protection.md)
- File trục: `backend/tests/conftest.py` (89 dòng)

## Overview

- **Ưu tiên:** P0 · **Trạng thái:** 📋 TODO
- 93 test hiện gọi thẳng router qua `TestClient` không kèm auth ⇒ sau phase 02 sẽ đỏ hàng loạt (401/403). Sửa **tập trung ở `conftest.py`**, không rải qua từng file test.

## Key Insights (đã verify)

1. Fixture `client` ở `conftest.py:68` là **cửa vào duy nhất** — mọi test dùng nó ⇒ sửa 1 chỗ là phần lớn test chạy lại. Đây là lý do fixture thắng cờ `AUTH_DISABLED` (Q4).
2. Phân bố test hiện tại (đếm `def test_`): `test_agent_config.py` 28, `test_kb.py` 14, `test_web_call_dev_tool.py` 14, `test_call_history.py` 10, `test_leads_crud.py` 7, `test_edge_cases.py` 5, `test_warm_transfer_webhook.py` 4, `test_call_record.py`/`test_calls_list_and_webhook_auth.py`/`test_leads.py` mỗi cái 3, `test_webhook_idempotency.py` 2 → **93**.
3. Test webhook (`test_warm_transfer_webhook`, `test_webhook_idempotency`, phần webhook của `test_calls_list_and_webhook_auth`) **không cần sửa** — phase 02 không chạm webhook. Xác nhận bằng chạy thử, đừng đoán.
4. `test_agent_config.py` (28) + `test_kb.py` (14) + `test_web_call_dev_tool.py` (14) = 56 test đụng endpoint **admin-only** ⇒ chúng cần `client` là admin. ⇒ **mặc định `client` = admin** là lựa chọn ít sửa nhất.
5. `db_session` chạy trong transaction rollback mỗi test ⇒ user tạo trong đó **biến mất sau mỗi test**. `get_current_user` query DB qua cùng `db_session` override ⇒ nhất quán. Nhưng cookie phải sinh lại mỗi test hoặc user phải tồn tại — giải pháp: tạo user **trong `db_session`** ở fixture rồi ký cookie từ `user.id` ngay trong test đó.
6. bcrypt cost 12 × 93 test = chậm rõ rệt. Fixture tạo user nên dùng hash **đã tính sẵn một lần** (module-level constant) thay vì hash lại mỗi test.

## Related Code Files

**Sửa**
- `backend/tests/conftest.py` — thêm `admin_user`, `viewer_user`, đổi `client` thành đã-đăng-nhập-admin, thêm `viewer_client`, `anon_client`

**Tạo mới**
- `backend/tests/test_auth.py` — test login/logout/me + ma trận phân quyền + test liệt kê route

**Chỉ sửa nếu thực sự đỏ** (chạy pytest rồi mới biết, đừng sửa mù): các test khẳng định status code ở endpoint đổi quyền.

## Architecture (fixture)

```
db_session (rollback) 
   ├─ admin_user   → User(role="admin",  hash=_PRECOMPUTED)
   ├─ viewer_user  → User(role="viewer", hash=_PRECOMPUTED)
   ├─ client       = TestClient + cookie ký từ admin_user.id   ← mặc định, 93 test cũ dùng
   ├─ viewer_client= TestClient + cookie ký từ viewer_user.id
   └─ anon_client  = TestClient không cookie
```

Cookie sinh bằng **chính serializer production** (`app.core.security`) với `test_settings.session_secret` ⇒ test đi qua đúng đường verify của production, không có nhánh tắt.

## Implementation Steps

1. `test_settings`: thêm `session_secret="test-session-secret-at-least-32-chars-long"`, `cookie_secure=False`.
2. Module-level `_TEST_PASSWORD_HASH = hash_password("test-password")` — tính 1 lần cho cả session test.
3. Fixture `admin_user(db_session)` / `viewer_user(db_session)`: insert `User`, `db_session.commit()`, trả object.
4. Helper `_client_for(user, ...)`: set `app.dependency_overrides` như cũ, tạo `TestClient`, `client.cookies.set("teleapo_session", _sign(user.id, test_settings))`.
5. `client` fixture: `_client_for(admin_user)` — **giữ nguyên tên**, nên 93 test cũ không phải đổi 1 chữ.
6. `viewer_client`, `anon_client` tương tự.
7. Chạy `pytest backend/tests -q`. Ghi lại danh sách test đỏ **trước khi sửa** — kỳ vọng ~0 test đỏ nếu bước 5 đúng; đỏ nào cũng phải đọc từng cái, **không** sửa hàng loạt bằng regex.
8. Viết `test_auth.py`:
   - `test_login_valid_credentials_sets_session_cookie`
   - `test_login_wrong_password_returns_401_without_user_enumeration_hint`
   - `test_login_inactive_user_returns_401`
   - `test_me_without_cookie_returns_401`
   - `test_me_with_admin_cookie_returns_role_admin`
   - `test_logout_clears_cookie_then_me_returns_401`
   - `test_tampered_cookie_returns_401`
   - `test_viewer_calls_export_returns_403`
   - `test_viewer_agent_config_patch_returns_403`
   - `test_viewer_kb_documents_returns_403`
   - `test_viewer_web_call_returns_403`
   - `test_anonymous_leads_list_returns_401`
   - `test_health_endpoint_public_returns_200`
   - `test_retell_webhook_works_without_session_cookie`
   - `test_kb_retell_function_call_works_without_session_cookie`
   - `test_all_routes_except_allowlist_require_auth_dependency` — duyệt `app.routes`, với mỗi route không nằm trong allowlist (`/health`, `/auth/login`, `/docs`, `/openapi.json`, `/redoc`, `/webhooks/retell`, `/kb/retell-function-call`) khẳng định có `get_current_user` trong `route.dependant` (gộp router-level + decorator-level).

Đặt tên theo `test_[hệ thống]_[tình huống]_[kết quả]`, cấu trúc Arrange/Act/Assert — theo `.claude/workflows/test-standards.md`.

## Todo List

- [ ] `test_settings` thêm `session_secret`, `cookie_secure`
- [ ] `_TEST_PASSWORD_HASH` module-level (tránh bcrypt mỗi test)
- [ ] Fixture `admin_user`, `viewer_user`
- [ ] `client` = admin đã đăng nhập (giữ tên fixture)
- [ ] Fixture `viewer_client`, `anon_client`
- [ ] Chạy `pytest -q`, ghi danh sách đỏ, sửa từng cái
- [ ] `test_auth.py` với 16 ca ở bước 8
- [ ] Test liệt kê route (chống quên endpoint mới)
- [ ] Xác nhận tổng số test ≥ 93 + 16 và **toàn bộ xanh**

## Success Criteria

- `pytest backend/tests -q` → **0 failed**, tổng ≥ 109 test.
- Không có file test nào chứa `AUTH_DISABLED` / cờ bypass (`grep` phải rỗng).
- `test_all_routes_except_allowlist_require_auth_dependency` xanh — tức mọi route mới thêm sau này mà quên auth sẽ **làm đỏ CI**.
- Thời gian chạy test không tăng quá ~20% so với trước (đo trước/sau; nếu vượt, xem lại bcrypt cost).

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Sửa hàng loạt bằng regex làm test mất ý nghĩa | Bước 7 bắt buộc đọc từng test đỏ; cấm sed toàn thư mục |
| bcrypt làm test chậm gấp nhiều lần | Hash tính 1 lần module-level; nếu vẫn chậm, hạ `bcrypt__rounds=4` **chỉ trong test_settings** |
| User tạo trong `db_session` bị rollback trước khi request chạy | `db_session` được override làm `get_db` nên request dùng **cùng** session ⇒ thấy user; nếu vỡ, chuyển sang `db_session.flush()` + không commit |
| Test cũ sửa quá tay, vô tình đổi assert nghiệp vụ | Success criteria yêu cầu diff test cũ chỉ được động tới fixture/status auth |

## Security Considerations

- **Không** có đường tắt bỏ auth trong test ⇒ không tồn tại cờ nào để đặt nhầm trên production (đây là lý do chính chọn fixture, xem Q4).
- Test khẳng định cookie bị sửa đổi → 401 (chứng minh chữ ký có tác dụng).
- Test khẳng định 2 webhook vẫn chạy không cookie (chống hồi quy khi ai đó "dọn cho đồng bộ").

## Next Steps

Xong phase này → backend an toàn để deploy nội bộ. Frontend: [phase-04](phase-04-frontend-login.md).
