# Phase 01 — Backend auth core

## Context Links

- Overview: [plan.md](plan.md)
- Blocker gốc: `plans/20260924-1030-teleapo-dashboard-ui/plan.md` §8
- Alembic head hiện tại: `c4d8f61a9b02` (`add_kb_documents`)
- Pattern secret không-default: `backend/app/core/config.py:15` (`retell_webhook_secret: str`)

## Overview

- **Ưu tiên:** P0 · **Trạng thái:** 📋 TODO · **Phụ thuộc:** —
- Dựng nền: bảng `users`, hash password, cookie phiên ký, 3 endpoint `/auth/*`, CLI tạo user. **Chưa bật enforce** (phase 02) ⇒ phase này merge được mà không gãy gì.

## Key Insights

1. `backend/app/db/session.py` gọi `get_settings()` **ngay lúc import module** ⇒ thêm field bắt buộc vào `Settings` mà quên `.env` thì app **không import được**, lỗi khó đọc. Phải cập nhật `.env.example` + docker-compose docs cùng commit.
2. Chain Alembic có 1 merge point (`2c9fb5de473e`); head hiện tại là `c4d8f61a9b02`. Migration mới nối vào đó, **không** tạo nhánh mới.
3. `itsdangerous` đã là dep gián tiếp của Starlette nhưng **không** khai trong `requirements.txt` ⇒ khai tường minh (không dựa vào transitive dep).
4. Mock/test không được dùng bcrypt cost mặc định 12 cho mọi test — chậm. Dùng `bcrypt__rounds=4` khi `PYTEST_CURRENT_TEST` có mặt, hoặc tạo user test 1 lần ở fixture `scope="session"`.

## Requirements

**Chức năng**
- Tạo user với `username`, `password`, `role ∈ {admin, viewer}`.
- `POST /auth/login` đúng → Set-Cookie phiên; sai → 401, thông báo **không** phân biệt "sai user" vs "sai pass".
- `POST /auth/logout` → xoá cookie.
- `GET /auth/me` → thông tin user hiện tại; 401 nếu chưa đăng nhập.
- User `is_active=false` không đăng nhập được, và cookie cũ của họ **không còn dùng được** (check DB mỗi request).

**Phi chức năng**
- Password hash bcrypt, không bao giờ trả ra API / ghi log.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` khi không phải dev (điều khiển qua `cookie_secure: bool = False`), `max_age` 8 giờ.
- `SESSION_SECRET` bắt buộc, độ dài ≥ 32 ký tự (validate ở Pydantic).

## Architecture

```
POST /auth/login
  └─ verify bcrypt → itsdangerous.URLSafeTimedSerializer.dumps({"uid": ...})
       └─ Set-Cookie teleapo_session=<signed>

mọi request cần auth
  └─ get_current_user(Cookie) → loads(max_age=8h) → SELECT users WHERE id AND is_active
       ├─ thiếu/hỏng/hết hạn → 401
       └─ ok → CurrentUser(id, username, role)
```

Cố tình **không** có bảng `sessions`: phiên sống trong cookie ký; thu hồi = `is_active=false` (tức thì, vì mỗi request có query DB) hoặc đổi `SESSION_SECRET` (đá hết mọi người ra).

## Related Code Files

**Tạo mới**
- `backend/app/db/models.py` → thêm `class User` (cùng file, không tách — file hiện chỉ ~100 dòng)
- `backend/app/core/security.py` — hash/verify password, serializer cookie
- `backend/app/auth.py` — `get_current_user`, `require_user`, `require_admin`, `CurrentUser`
- `backend/app/routers/auth.py` — router `/auth`
- `backend/app/schemas/auth.py` — `LoginRequest`, `UserResponse`
- `backend/alembic/versions/e1f2a3b4c5d6_add_users.py`
- `backend/scripts/create_user.py` + `backend/scripts/__init__.py`

**Sửa**
- `backend/app/core/config.py` — `session_secret: str` (không default), `cookie_secure: bool = False`, `session_max_age_seconds: int = 28800`
- `backend/requirements.txt` — `passlib[bcrypt]==1.7.4`, `bcrypt==4.2.1`, `itsdangerous==2.2.0`
- `backend/app/main.py` — `include_router(auth.router)` + sửa CORS `allow_credentials=True`
- `backend/.env.example` (tạo nếu chưa có) — `SESSION_SECRET=`

**Không đụng:** `routers/{leads,calls,agent_config,kb,webhooks,web_calls}.py` (phase 02 mới chạm, và chỉ ở `main.py`).

## Implementation Steps

1. **requirements**: thêm 3 dep, `pip install -r backend/requirements.txt` trong `.venv`.
2. **config**: thêm 3 field. `session_secret` dùng `Field(min_length=32)` ⇒ boot fail sớm, rõ lý do.
3. **models**: `User(id: UUID pk, username: String(64) unique index, password_hash: String(128), role: String(16), is_active: bool default True, created_at: DateTime(tz))`. Role lưu `String` + validate ở Pydantic, **không** dùng Postgres ENUM (đổi giá trị sau phải migration).
4. **migration** `e1f2a3b4c5d6`, `down_revision = 'c4d8f61a9b02'`: `op.create_table("users", ...)` + `op.create_index("ix_users_username", "users", ["username"], unique=True)`. `downgrade()` drop index rồi drop table.
5. **security.py**: `CryptContext(schemes=["bcrypt"], deprecated="auto")` → `hash_password`, `verify_password`; `_serializer(settings)` trả `URLSafeTimedSerializer(settings.session_secret, salt="teleapo-session")`.
6. **auth.py**:
   - `CurrentUser` = dataclass/Pydantic `(id, username, role)`.
   - `get_current_user(request, db, settings)` → đọc `request.cookies.get("teleapo_session")`; `None`/`BadSignature`/`SignatureExpired` → `HTTPException(401, "Chưa đăng nhập")`; query user, `is_active` false → 401.
   - `require_user = Depends(get_current_user)` dùng trực tiếp.
   - `require_admin(user = Depends(get_current_user))` → role != "admin" ⇒ `HTTPException(403, "Cần quyền admin")`.
7. **routers/auth.py**: 3 endpoint. `login` set cookie qua `response.set_cookie(key="teleapo_session", value=token, httponly=True, samesite="lax", secure=settings.cookie_secure, max_age=settings.session_max_age_seconds)`. Sai credential → `401 "Sai tên đăng nhập hoặc mật khẩu"` (một thông báo chung). `logout` → `response.delete_cookie` cùng bộ thuộc tính.
8. **main.py**: `app.include_router(auth.router)`; đổi CORS thành `allow_origins=settings.cors_origins_list()`, `allow_credentials=True`. ⚠️ `allow_origins=["*"]` + credentials bị browser từ chối ⇒ phải liệt kê `http://localhost:5173` tường minh (đang đã vậy, chỉ thêm `allow_credentials`).
9. **scripts/create_user.py**: argparse `--username --password --role [--reset-password]`; mở `SessionLocal()`, upsert, in kết quả. Chạy: `docker compose exec backend python -m scripts.create_user --username admin --password '...' --role admin`.
10. **Chạy migration** `alembic upgrade head`, tạo 1 admin + 1 viewer để dùng cho phase 03/04.

## Todo List

- [ ] Thêm `passlib[bcrypt]`, `bcrypt`, `itsdangerous` vào `requirements.txt`
- [ ] `Settings`: `session_secret` (bắt buộc, ≥32), `cookie_secure`, `session_max_age_seconds`
- [ ] `models.User` + migration `e1f2a3b4c5d6` (down_revision `c4d8f61a9b02`)
- [ ] `core/security.py` (hash/verify + serializer)
- [ ] `auth.py` (`get_current_user`, `require_admin`, `CurrentUser`)
- [ ] `schemas/auth.py` + `routers/auth.py` (login/logout/me)
- [ ] `main.py`: include auth router + `allow_credentials=True`
- [ ] `scripts/create_user.py`
- [ ] `.env.example` + ghi `SESSION_SECRET` vào docs/README
- [ ] `alembic upgrade head` + tạo admin/viewer thật
- [ ] Test: login đúng/sai, me khi chưa login, user `is_active=false` bị chặn

## Success Criteria

- `curl -i -X POST /auth/login` đúng credential → `200` + header `Set-Cookie: teleapo_session=...; HttpOnly; SameSite=lax`.
- Sai credential → `401`, body **không** tiết lộ user có tồn tại hay không.
- `GET /auth/me` với cookie → `{"id","username","role"}`; không cookie → `401`.
- `alembic downgrade -1` rồi `upgrade head` chạy sạch.
- 93 test cũ **vẫn pass** (phase này chưa enforce).
- `grep -r password_hash backend/app/schemas` → không có (hash không lọt ra response).

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Thêm field bắt buộc → app không boot local | `.env.example` + lệnh `openssl rand -hex 32` ghi trong todo; báo user sinh secret trước khi chạy |
| bcrypt làm test chậm | Giảm rounds trong test settings hoặc tạo user 1 lần ở fixture session-scope (phase 03 quyết) |
| `passlib` 1.7.4 cảnh báo với `bcrypt>=4.1` (`__about__`) | Ghim `bcrypt==4.2.1` và xác nhận `hash/verify` chạy được ngay bước 1; nếu vỡ, chuyển dùng thẳng `bcrypt` không qua passlib (giảm 1 lớp) |

## Security Considerations

- Thông báo lỗi login **không** phân biệt user-không-tồn-tại vs sai-mật-khẩu (chống liệt kê user).
- Cookie `HttpOnly` ⇒ XSS không đọc được phiên. `SameSite=Lax` ⇒ chặn CSRF cho POST cross-site.
- Không log request body của `/auth/login`.
- `SESSION_SECRET` **không** commit; coi như secret ngang `retell_webhook_secret`.
- Kiểm `is_active` mỗi request ⇒ vô hiệu hoá nhân sự nghỉ việc có hiệu lực ngay, không chờ cookie hết hạn.

## Dự phòng (chưa làm, ghi để khỏi thiết kế lại)

Cần thu hồi **từng phiên** (vd "đăng xuất mọi thiết bị") → thêm cột `users.token_version int`, nhét vào payload cookie, so khi verify. Migration 1 cột, không đổi kiến trúc.

## Next Steps

→ [phase-02-router-protection.md](phase-02-router-protection.md)
