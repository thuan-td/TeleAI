# Plan — Auth/RBAC cho TeleApo Clone

**Ngày:** 2026-09-25 · **Trạng thái:** DRAFT — chờ user chốt Q1–Q5 (§8) trước `/avatar:implement`
**Dự án:** `src/teleapo-clone` (FastAPI 0.115 / Python 3.12 + React 19/Vite/TS + Postgres 16)

## 1. Mục tiêu

Gỡ blocker cứng ghi ở `plans/20260924-1030-teleapo-dashboard-ui/plan.md` §8: *"chưa có auth ⇒ chỉ chạy localhost/mạng nội bộ"*. Sau plan này, app deploy được ra mạng công ty / internet có rào.

Hiện trạng đã verify: `backend/app/main.py` chỉ có `CORSMiddleware`; **mọi** router (`/leads`, `/calls`, `/agent`, `/kb`) public, không check identity. Nguy hiểm nhất: `GET /calls/export` (xuất hàng loạt recording + transcript khách hàng) và `PATCH /agent/config` (sửa prompt của agent đang gọi khách thật).

## 2. Phương án chốt (đề xuất mặc định)

**Session cookie + password hash, user lưu DB, 2 role (`admin` / `viewer`).**

| Quyết định | Chọn | Vì sao (KISS/YAGNI) |
|---|---|---|
| Cơ chế | **Cookie phiên ký (`itsdangerous`), HttpOnly + SameSite=Lax** | Không có XSS-token-theft như JWT-in-localStorage; không cần refresh-token; logout thật (server xoá phiên); frontend không phải viết interceptor lưu token. So sánh đầy đủ: §3. |
| Mật khẩu | **bcrypt qua `passlib[bcrypt]`** | 1 dep, chuẩn ngành, không tự chế. |
| Actor | **Bảng `users` trong Postgres** | ~5–15 người; cần đổi mật khẩu/vô hiệu hoá mà không redeploy. |
| Role | **2 role: `admin`, `viewer`** | Không phải 1 role: `PATCH /agent/config` + `DELETE /kb/documents` + `GET /calls/export` là 3 hành động sai-là-chết mà telesale viên không cần. Không phải 4+ role: chưa có nhu cầu (YAGNI). |
| Enforce | **`dependencies=[...]` ở tầng `include_router`** trong `main.py` | 1 chỗ, không rải `Depends` vào 40+ handler ⇒ không thể quên endpoint mới. |
| Tạo user | **CLI script `backend/scripts/create_user.py`** | Không cần UI quản trị user cho 5–15 người (YAGNI). |

**Không làm (cố ý):** OAuth/Google SSO, MFA, refresh token, quên-mật-khẩu qua email, audit log đầy đủ, rate-limit phân tán, multi-tenant thật (giữ `DEFAULT_ORG_ID`).

## 3. So sánh cơ chế (rút gọn)

| | Session cookie ✅ | JWT stateless | API key tĩnh |
|---|---|---|---|
| Lượng code | Vừa (cookie + bảng users) | Vừa+ (encode/decode + interceptor FE) | Ít nhất |
| Logout / thu hồi | **Tức thì** (xoá cookie + bump `token_version`) | Không thể trước khi hết hạn (cần denylist ⇒ mất "stateless") | Phải đổi key cho tất cả |
| Lộ token qua XSS | Thấp (HttpOnly, JS không đọc được) | **Cao** nếu localStorage | Cao |
| Biết ai làm gì | Có (`user_id`) | Có | **Không** — key dùng chung |
| Cần CSRF guard | Có (đã xử lý: SameSite=Lax + API khác-origin) | Không | Không |
| Hợp cho | **Web app nội bộ 1 frontend ← đúng ca này** | Mobile / nhiều client / service-to-service | Script máy-với-máy |

⇒ API key tĩnh loại vì không truy vết được ai export data khách hàng. JWT loại vì chi phí ngang session nhưng mất khả năng thu hồi — lợi ích stateless vô nghĩa khi chỉ có 1 backend instance.

## 4. Phases

| Phase | Tên | Mô tả 1 câu | Ưu tiên | Trạng thái | Phụ thuộc |
|---|---|---|---|---|---|
| [01](phase-01-backend-auth-core.md) | Backend auth core | Bảng `users` + migration + hash password + `/auth/login,logout,me` + CLI tạo user. | P0 | 📋 TODO | — |
| [02](phase-02-router-protection.md) | Bọc auth quanh router | Gắn `require_user` / `require_admin` ở `main.py`, giữ nguyên 2 webhook secret + `/health` public. | P0 | 📋 TODO | 01 |
| [03](phase-03-test-fixtures.md) | Sửa 93 test hiện có | Fixture `client` đăng nhập sẵn; thêm test auth-negative. | P0 | 📋 TODO | 02 |
| [04](phase-04-frontend-login.md) | Frontend login | Trang `/login`, `apiFetch` wrapper gắn `credentials: "include"` + xử lý 401, ẩn nav theo role. | P1 | 📋 TODO | 02 |

```
01 ──► 02 ──► 03
              └──► 04   (03 và 04 chạy song song được sau khi 02 xong)
```

## 5. API contract mới

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| POST | `/auth/login` | public | body `{username, password}` → Set-Cookie `teleapo_session`; 401 nếu sai |
| POST | `/auth/logout` | user | xoá cookie |
| GET | `/auth/me` | user | `{id, username, role}` — FE gọi lúc boot để biết đã đăng nhập chưa |

**Ma trận phân quyền** (chi tiết: phase-02):

| Nhóm endpoint | viewer | admin |
|---|---|---|
| `GET /leads*`, `GET /calls*` (kể cả `/calls/{id}`) | ✅ | ✅ |
| `POST/PATCH/DELETE /leads*` | ✅ | ✅ |
| `POST /calls` (dial thật) | ✅ | ✅ |
| `GET /calls/export` | ❌ 403 | ✅ |
| `/agent/*` (config, voices) | ❌ 403 | ✅ |
| `/kb/documents*` ghi/xoá, `/kb/query` | ❌ 403 | ✅ |
| `POST /calls/web`, `/calls/web/openai` (dev tool) | ❌ 403 | ✅ |
| `POST /webhooks/retell`, `POST /kb/retell-function-call` | **giữ nguyên secret riêng — KHÔNG đụng** | |
| `GET /health` | **public** | |

## 6. Thay đổi DB

| Thay đổi | Lý do |
|---|---|
| Bảng mới `users` (`id` UUID PK, `username` unique, `password_hash`, `role`, `is_active`, `created_at`) | lưu actor |
| Migration `e1f2a3b4c5d6_add_users.py`, `down_revision = 'c4d8f61a9b02'` (head hiện tại) | theo chain Alembic có sẵn |

Không thêm bảng `sessions` — phiên nằm trong cookie ký (stateless-signed), thu hồi bằng `is_active=false` + đổi `SESSION_SECRET`. Nếu sau cần thu hồi từng phiên riêng thì thêm cột `token_version` (ghi sẵn ở phase-01 §Dự phòng).

## 7. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Thêm auth làm gãy 93 test hiện có | Phase 03 làm fixture đăng nhập sẵn ở `conftest.py` — **không** bypass bằng env flag (xem Q4) |
| Cookie không gửi được vì FE:5173 ↔ BE:8008 khác origin | `allow_credentials=True` + `allow_origins` phải là **danh sách cụ thể, không `*`** (FastAPI/CORS chặn `*` khi có credentials) + FE `credentials: "include"`. Test bằng browser thật, không chỉ TestClient. |
| Quên bảo vệ endpoint mới thêm sau này | Enforce ở `include_router`, cộng test "liệt kê mọi route, khẳng định có dependency auth" (phase-03) |
| `SESSION_SECRET` rỗng ⇒ cookie ký bằng chuỗi rỗng | `Settings.session_secret` **không có default** (giống `retell_webhook_secret`) ⇒ app không boot nếu thiếu |
| `main.py` import `session.py` → `get_settings()` lúc import module; thêm field bắt buộc làm vỡ chạy local thiếu `.env` | Cập nhật `backend/.env.example` + ghi rõ trong phase-01 todo |
| Lộ mật khẩu qua log | Không log body `/auth/login`; schema Pydantic dùng `SecretStr` ở response (không bao giờ trả hash) |

## 8. Câu hỏi treo — cần user chốt trước khi implement

### Q1. Cơ chế auth: session cookie, JWT, hay API key tĩnh?

- **Khuyến nghị:** **Session cookie ký** (phương án mặc định của plan này, §2–§3).
- **Hệ quả nếu chọn sai:** Chọn **API key tĩnh** → rẻ nhất nhưng **không biết ai** export recording/transcript khách hàng; một người nghỉ việc là phải đổi key cho cả team, và key thường bị dán vào chat/Postman ⇒ coi như không có rào. Chọn **JWT localStorage** → tốn công tương đương session nhưng **không logout/thu hồi được** trước hạn, và bất kỳ XSS nào trên dashboard là mất token; sau này muốn thu hồi phải xây denylist = quay lại stateful, code bỏ đi.
- **Độ tin cậy:** **Cao.** Đã verify chỉ có 1 frontend (`frontend/src/api/*.ts`, cùng browser) và 1 backend instance (`docker-compose.yml`) ⇒ lợi ích "stateless scale ngang" của JWT không tồn tại ở đây; điều kiện chọn session cookie thoả hoàn toàn.

### Q2. Số role: 1 role (ai đăng nhập được thì làm hết) hay 2 role (`admin`/`viewer`)?

- **Khuyến nghị:** **2 role.** Chi phí thêm đúng 1 cột `role` + 1 dependency `require_admin`, không phải hệ RBAC.
- **Hệ quả nếu chọn sai:** Chọn **1 role** → mọi telesale viên đều `PATCH /agent/config` được, tức sửa prompt của agent đang gọi khách thật (plan dashboard §7 xếp đây là rủi ro hàng đầu) và `GET /calls/export` toàn bộ recording; một cú nhầm là sự cố dữ liệu khách hàng, và retrofit role sau phải sửa lại toàn bộ test + FE. Chọn **>2 role** (manager/operator/auditor…) → over-engineering, chưa có yêu cầu nghiệp vụ nào đòi.
- **Độ tin cậy:** **Cao** về mặt kỹ thuật (ranh giới admin-only rõ ràng: `/agent/*`, `/kb` ghi, `/calls/export`, `/calls/web*`). **Trung bình** về ranh giới nghiệp vụ: chưa rõ telesale viên có được **xoá lead** không — plan tạm cho viewer xoá (soft delete, hồi được). Nếu user muốn khắt khe hơn thì chuyển `DELETE /leads/{id}` sang admin-only, sửa 1 dòng.

### Q3. Ai được `GET /calls/export` và nghe recording?

- **Khuyến nghị:** **Export = admin-only**; nghe/đọc transcript từng cuộc (`GET /calls/{id}`) = mọi user đăng nhập.
- **Hệ quả nếu chọn sai:** Mở export cho viewer → 1 request lấy trọn CSV 10.000 hàng recording-url + transcript, mang ra ngoài không dấu vết; đây là dữ liệu cá nhân khách hàng (rủi ro pháp lý, không chỉ kỹ thuật). Siết cả `GET /calls/{id}` về admin → viewer không làm được việc chính (nghe lại cuộc gọi của mình) ⇒ auth thành vật cản, người dùng đòi bỏ.
- **Độ tin cậy:** **Trung bình-Cao.** Ranh giới kỹ thuật chắc; chưa biết quy trình thực tế của team telesale có ai cần export định kỳ không. Nếu có, cấp thêm tài khoản admin cho người đó, **đừng** hạ quyền endpoint.

### Q4. Test: fixture đăng nhập sẵn hay biến env `AUTH_DISABLED=1` trong test?

- **Khuyến nghị:** **Fixture đăng nhập sẵn** trong `conftest.py` (`client` = đã login admin; thêm `viewer_client`, `anon_client`).
- **Hệ quả nếu chọn sai:** Chọn `AUTH_DISABLED` → 93 test pass mà **không test gì về auth**; tệ hơn, cờ đó tồn tại trong code production và chỉ cần một biến env đặt nhầm trên server là mở toang toàn bộ API — đây là lớp lỗi đã gây sự cố thật ở nhiều dự án. Chọn fixture → tốn ~1 buổi sửa `conftest.py` và các test khẳng định status code, nhưng đường đi trong test **giống hệt** production.
- **Độ tin cậy:** **Cao.** Đã đọc `conftest.py`: `client` là fixture tập trung duy nhất, các test đều dùng nó ⇒ sửa 1 chỗ là phần lớn test chạy lại được; chỉ những test khẳng định 401/403 cần đụng tay.

### Q5. Tạo/quản lý user: CLI script hay UI quản trị trong app?

- **Khuyến nghị:** **CLI `python -m scripts.create_user`** chạy trong container backend, cộng `--reset-password`.
- **Hệ quả nếu chọn sai:** Làm **UI quản trị** ngay → thêm ~1 phase (trang, form, validate, test) cho việc chạy vài lần/năm với 5–15 người (YAGNI); và UI tạo user là bề mặt tấn công mới phải tự bảo vệ. Chỉ **CLI** → mỗi lần thêm người phải có người có quyền vào server chạy lệnh; nếu team thay đổi nhân sự liên tục thì phiền.
- **Độ tin cậy:** **Trung bình.** Phụ thuộc quy mô/tần suất onboard mà plan chưa có số liệu. Giả định đang dùng: team nội bộ, dưới ~15 người, ít biến động. **Sai giả định này thì đổi câu trả lời** — nói rõ để user phản bác.

## 9. Ước tính

| Phase | Backend | Frontend | Test | Tổng |
|---|---|---|---|---|
| 01 | ~1 ngày | — | ~0.5 ngày | **~1.5 ngày** |
| 02 | ~0.5 ngày | — | — | **~0.5 ngày** |
| 03 | — | — | ~1 ngày | **~1 ngày** |
| 04 | — | ~1.5 ngày | ~0.5 ngày | **~2 ngày** |

**Tuần tự ~5 ngày.** Chưa gồm review + sửa theo feedback.

## 10. Ràng buộc bất biến

- **KHÔNG đổi logic nghiệp vụ** của 3 phase DONE (`plans/20260924-1030-teleapo-dashboard-ui/`): Lead CRUD, Call History, Agent Config. Auth **bọc quanh**, không sửa thân handler.
- **KHÔNG đụng** 2 webhook shared-secret: `POST /webhooks/retell` (`X-Webhook-Secret`) và `POST /kb/retell-function-call` (`X-KB-Webhook-Secret`). Chúng do Retell gọi từ internet, **không** có cookie.
- `GET /health` giữ public (probe hạ tầng).
- Whitelist số điện thoại (`calls.py`) giữ nguyên — TD6, không nới.
