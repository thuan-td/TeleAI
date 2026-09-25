# Phase 04 — Frontend login

## Context Links

- Overview: [plan.md](plan.md)
- Phụ thuộc: [phase-02](phase-02-router-protection.md)
- File trục: `frontend/src/api/calls.ts:47` (`API_BASE`), `frontend/src/App.tsx`, `frontend/src/components/AppLayout.tsx`

## Overview

- **Ưu tiên:** P1 · **Trạng thái:** 📋 TODO
- Trang `/login` tối thiểu + gắn cookie vào mọi request + xử lý 401/403 + ẩn nav theo role.

## Key Insights (đã verify)

1. **Không có router library** — `App.tsx` điều hướng bằng `window.location.pathname` chuỗi `if`. ⇒ **không** thêm `react-router` (YAGNI); thêm 1 nhánh `if (pathname === "/login")` theo đúng lối cũ.
2. **Không có client HTTP dùng chung.** 4 file `api/*.ts` gọi `fetch` trực tiếp, mỗi file tự có `parseErrorOrThrow`/`parseErrorDetail` riêng (đã DRY-vi phạm sẵn). ⇒ thêm `api/client.ts` với `apiFetch()` và **thay mọi lời gọi `fetch(` trong `api/*.ts`** — đây là điểm chạm duy nhất, không lan vào component.
3. Với cookie thì **không cần interceptor lưu token** — chỉ cần `credentials: "include"` trên mọi request. Đây là lợi thế thực tế của session cookie so với JWT trong ca này.
4. `buildExportUrl` (`api/calls.ts:81`) trả URL cho thẻ `<a download>` ⇒ browser tự gửi cookie same-site... **nhưng FE:5173 và BE:8008 khác port = khác origin**, navigation cross-origin **có** gửi cookie `SameSite=Lax` (đây là top-level GET navigation, Lax cho phép). Vẫn phải test tay; nếu hỏng, đổi sang `fetch` + `blob` + `URL.createObjectURL`.
5. `i18n` có 3 locale (`vi/ja/en`) — chuỗi mới phải thêm đủ 3 file, nếu không key hiện thô trên UI.
6. `VITE_API_BASE_URL` mặc định `http://localhost:8000` nhưng docker-compose map `8008` ⇒ giá trị env đang gánh; không đổi.

## Requirements

**Chức năng**
- `/login`: form username/password, submit → `POST /auth/login`; thành công → chuyển về `/`; sai → hiện lỗi.
- Boot app: gọi `GET /auth/me`; 401 → chuyển `/login`; ok → render, giữ `role` trong state.
- Mọi API call gửi cookie; nhận 401 giữa chừng → đá về `/login` (phiên hết hạn).
- 403 → hiện thông báo "không đủ quyền", **không** đá về login.
- Nav ẩn mục admin-only với viewer; hiện tên user + nút Đăng xuất.

**Phi chức năng**
- Không lưu mật khẩu/token vào `localStorage` (cookie HttpOnly lo hết).
- Không thêm dependency npm mới.

## Related Code Files

**Tạo mới**
- `frontend/src/api/client.ts` — `apiFetch`, `ApiError` (mang `status`), `login`, `logout`, `fetchMe`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/auth/useCurrentUser.ts` — hook gọi `/auth/me`, trả `{user, isLoading}`

**Sửa**
- `frontend/src/api/{calls,leads,kb,agentConfig}.ts` — đổi `fetch(` → `apiFetch(`, bỏ hàm parse-error trùng lặp (DRY)
- `frontend/src/App.tsx` — nhánh `/login` + gate `useCurrentUser`
- `frontend/src/components/AppLayout.tsx` — lọc `NAV_ITEMS` theo role, thêm user badge + Đăng xuất
- `frontend/src/i18n/locales/{vi,ja,en}.json` — key `auth.*`

**Không đụng:** mọi component nghiệp vụ (`CallList`, `CallDetail`, `LeadsPage`, `AgentConfigPage`, 2 WebCallTester) — chúng gọi qua `api/*.ts` nên hưởng auth miễn phí.

## Architecture

```
main.tsx → App
             ├─ pathname === "/login" → LoginPage (không gate)
             └─ useCurrentUser()
                  ├─ isLoading → skeleton
                  ├─ user == null → window.location.href = "/login"
                  └─ user → AppLayout(role) > trang hiện tại
```

`apiFetch` là chỗ duy nhất biết về `credentials` và 401 ⇒ thêm endpoint mới tự động được bảo vệ.

## Implementation Steps

1. **`api/client.ts`**:
   ```ts
   export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
   export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
     const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: "include" });
     if (res.status === 401 && window.location.pathname !== "/login") {
       window.location.href = "/login";
       throw new ApiError(401, "Phiên đăng nhập đã hết hạn");
     }
     return res;
   }
   ```
   Chuyển `API_BASE` từ `calls.ts` sang `client.ts`, `calls.ts` re-export để 3 file kia không gãy import.
2. **Refactor 4 file api**: thay `fetch(\`${API_BASE}/x\`)` → `apiFetch("/x")`. Gộp `parseErrorOrThrow`/`parseErrorDetail` về `client.ts` (xoá bản trùng).
3. **`LoginPage.tsx`**: form Tailwind theo style sẵn có (`rounded-md`, `bg-indigo-600`); submit gọi `login()`; lỗi hiện dải đỏ giống `App.tsx` hiện tại.
4. **`useCurrentUser.ts`**: `useEffect` gọi `fetchMe()`, state `{user, isLoading}`.
5. **`App.tsx`**: thêm `if (pathname === "/login") return <LoginPage/>` **trước** mọi nhánh khác; bọc phần còn lại bằng gate.
6. **`AppLayout.tsx`**: thêm `adminOnly: true` vào 3 mục nav (`/agent-config`, `/web-call-test`, `/web-call-test-openai`), lọc theo role; thêm badge username + nút Đăng xuất gọi `logout()` rồi `href="/login"`.
7. **Nút Export CSV** (`App.tsx`): chỉ render khi `role === "admin"` (khớp 403 của backend — tránh người dùng bấm rồi nhận lỗi khó hiểu).
8. **i18n**: thêm `auth.login`, `auth.username`, `auth.password`, `auth.submit`, `auth.error`, `auth.logout`, `auth.forbidden` vào cả 3 locale.
9. **Test tay trên browser thật** (TestClient không kiểm được cookie cross-origin): đăng nhập → reload giữ phiên → gọi API → export CSV tải được → đăng xuất → bị đá về login.

## Todo List

- [ ] `api/client.ts` (`apiFetch`, `ApiError`, `login`/`logout`/`fetchMe`, `API_BASE`)
- [ ] Refactor `api/calls.ts`, `leads.ts`, `kb.ts`, `agentConfig.ts` → `apiFetch` + bỏ parse-error trùng
- [ ] `pages/LoginPage.tsx`
- [ ] `auth/useCurrentUser.ts`
- [ ] `App.tsx`: nhánh `/login` + gate + ẩn nút Export với viewer
- [ ] `AppLayout.tsx`: lọc nav theo role + badge user + Đăng xuất
- [ ] i18n 3 locale
- [ ] `npm run build` (tsc -b) + `npm run lint` sạch
- [ ] Test tay 6 ca ở bước 9 trên browser

## Success Criteria

- Chưa đăng nhập, mở `/leads` → tự chuyển `/login`.
- Đăng nhập admin → thấy đủ 5 mục nav + nút Export.
- Đăng nhập viewer → **không** thấy `/agent-config` và 2 mục web-call-test, **không** thấy nút Export; gõ tay URL `/agent-config` → trang báo "không đủ quyền" (API trả 403), không loop login.
- F5 sau khi đăng nhập → vẫn đăng nhập (cookie sống).
- Export CSV tải được file đúng nội dung (cookie đi kèm navigation).
- Đăng xuất → gọi API bất kỳ → bị đá về `/login`.
- `grep -rn "localStorage" frontend/src/api frontend/src/auth` → rỗng (không lưu credential).
- `npm run build` + `npm run lint` không lỗi.

## Risk Assessment

| Rủi ro | Giảm thiểu |
|---|---|
| Cookie không gửi vì khác origin 5173↔8008 | BE `allow_credentials=True` + `allow_origins` liệt kê cụ thể (phase 01); FE `credentials: "include"`; **bắt buộc test browser thật**, TestClient không bắt được lỗi này |
| Export `<a download>` không mang cookie | Test tay riêng ca này; dự phòng: `apiFetch` + `blob` + `createObjectURL` (ghi sẵn để khỏi thiết kế lại) |
| Vòng lặp đá-về-login khi `/auth/me` cũng 401 | `apiFetch` không redirect khi đã ở `/login`; `LoginPage` không gọi `useCurrentUser` |
| Refactor 4 file api làm gãy trang đang chạy | Đổi cơ học `fetch`→`apiFetch`, giữ nguyên chữ ký hàm export ⇒ component không phải sửa; `tsc -b` bắt sai sót |
| Thiếu key i18n → UI hiện `auth.login` thô | Todo yêu cầu cả 3 locale; kiểm bằng đổi ngôn ngữ trên UI |

## Security Considerations

- Ẩn nav theo role là **UX, không phải bảo mật** — rào thật ở backend (phase 02). Không được suy ra "FE đã ẩn nên BE khỏi check".
- Không `localStorage` ⇒ XSS không lấy được phiên.
- Form login đặt `autocomplete="current-password"`, `type="password"`; không log giá trị.
- Production: bật `COOKIE_SECURE=true` và phục vụ qua HTTPS, nếu không cookie đi trần trên mạng.

## Next Steps

- Sau 4 phase: cập nhật `docs/system-architecture.md` (mục Auth) + gỡ cảnh báo §8 ở `plans/20260924-1030-teleapo-dashboard-ui/plan.md` — giao `docs-manager`.
- Việc lùi lại có chủ ý (chưa làm): audit log ghi ai export/sửa prompt; rate-limit `/auth/login`.
