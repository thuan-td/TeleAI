# Hướng dẫn nhờ hỗ trợ đăng ký Twilio + mua số Nhật (+81)

## Bối cảnh

TeleApo cần số điện thoại **+81 (Japan)** để agent Retell gọi ra khách hàng Nhật với caller ID hợp lý. Twilio yêu cầu xác minh danh tính (KYC qua Persona) trước khi mua số quốc tế — cần **hộ chiếu** hoặc giấy tờ tương đương. Người thực hiện việc này **chưa có hộ chiếu**, nên nhờ bạn (người có hộ chiếu) tạo tài khoản Twilio riêng, hoàn tất xác minh, mua số, rồi bàn giao lại quyền truy cập.

Toàn bộ việc dưới đây làm trên **tài khoản Twilio của riêng bạn** (không phải tài khoản ai khác), nên bạn giữ toàn quyền kiểm soát cho tới bước bàn giao cuối.

---

## Bước 1 — Tạo tài khoản Twilio mới

1. Vào https://www.twilio.com/try-twilio
2. Đăng ký bằng email của bạn (không cần dùng email công ty)
3. Xác nhận email, đăng nhập vào Console (`console.twilio.com`)

Tài khoản mới sẽ ở dạng **Trial** — có ít credit miễn phí, nhưng KHÔNG mua được số quốc tế (Japan) cho tới khi hoàn tất Bước 2.

---

## Bước 2 — Xác minh danh tính (Compliance Profile) bằng hộ chiếu

1. Trong Console, tìm menu **Trust Hub** (hoặc vào thẳng URL dạng `console.twilio.com/.../trusthub/compliance-profiles/primary/new-primary-compliance-profile`)
2. Chọn loại hồ sơ: **Individual** (cá nhân) — trừ khi bạn muốn đăng ký dưới tên pháp nhân công ty
3. Ở bước "Provide details", màn hình sẽ hiện **mã QR** để quét bằng camera điện thoại (dịch vụ xác minh là Persona, domain `perso.na`)
   - Quét QR bằng điện thoại, HOẶC bấm **"Send Email"** để nhận link làm trực tiếp trên máy tính
4. Trên điện thoại/link: chọn loại giấy tờ = **Passport**, chụp ảnh hộ chiếu + ảnh selfie theo hướng dẫn trên màn hình
5. Chờ xác minh (thường vài phút tới vài giờ) — kiểm tra lại trạng thái compliance profile trong Trust Hub

⚠️ Nếu xác minh bị từ chối (ảnh mờ, thông tin không khớp...) — thử lại, Persona thường cho phép resubmit.

---

## Bước 3 — Mua số điện thoại Japan (+81)

1. Sau khi compliance profile được duyệt, vào **Communications → Numbers & Services → Numbers → Buy a number** (hoặc URL `console.twilio.com/us1/develop/phone-numbers/manage/search`)
2. **Destination country**: chọn **Japan**
3. **Capabilities**: chỉ tick **Voice** (KHÔNG cần SMS/MMS — TeleApo chỉ dùng thoại)
4. Bấm **Next**, xem danh sách số khả dụng

⚠️ **Lưu ý quan trọng**: mua số Nhật thường cần thêm **regulatory bundle riêng cho số đó** (khác với compliance profile cá nhân ở Bước 2) — có thể yêu cầu thêm: địa chỉ liên hệ tại Nhật, mục đích sử dụng (end-user type), tài liệu bổ sung tùy loại số. Twilio sẽ tự hiện form yêu cầu ngay khi bạn chọn mua — cứ điền theo đúng field hiện ra trên UI.

- Nếu **không thấy số Japan nào khả dụng**, hoặc bundle yêu cầu giấy tờ pháp nhân công ty (không áp dụng được cho cá nhân) → dừng lại, báo người nhờ bạn biết ngay để họ đổi phương án (dùng số US tạm), **không tự ý mua số khác thay thế**.
5. Chọn 1 số, hoàn tất mua

---

## Bước 4 — Verify số điện thoại dùng để test

Vì tài khoản vẫn ở dạng Trial, Twilio chỉ cho **gọi tới số đã xác minh (Verified Caller ID)**.

1. Vào **Numbers & Services → Verified Caller IDs**
2. Thêm số điện thoại của team dùng để nghe thử cuộc gọi test (nhập số → nhận mã OTP qua SMS/call → xác nhận)

Lặp lại bước này cho mỗi số cần dùng để test trong giai đoạn benchmark.

---

## Bước 5 — Elastic SIP Trunk nối tới Retell

⚠️ **Cần xác nhận thêm trước khi làm bước này** — dự án hiện dùng model "Retell dashboard quản lý transfer call" (xem `docs/adr/0001-voice-provider.md`), nhưng thông tin SIP trunk endpoint chính xác của Retell (domain, port, phương thức auth) **chưa được xác nhận** trong tài liệu dự án. Trước khi cấu hình:

1. Vào Retell dashboard → tìm mục **"Import Number" / "BYO Telephony" / "SIP Trunk"** (tên chính xác có thể khác tùy phiên bản UI)
2. Đọc hướng dẫn Retell hiện ra — họ sẽ cho biết chính xác cần điền gì vào Twilio (Origination URI, credentials...)
3. Quay lại Twilio → **Elastic SIP Trunking → Create new Trunk**, điền theo đúng thông tin Retell yêu cầu
4. Gắn số +81 vừa mua vào trunk này

Nếu bước này không rõ ràng trên UI, chụp lại màn hình gửi cho người nhờ bạn để họ xác nhận đúng cách làm trước khi tiếp tục.

---

## Bước 6 — Bàn giao lại thông tin

**Không gửi Auth Token chính của tài khoản.** Thay vào đó:

1. Vào **Account → API keys & tokens → Create API key**
2. Chọn loại **Restricted** (không phải Standard/Main) — giới hạn quyền chỉ ở mức cần thiết (Voice, Programmable Voice) thay vì toàn quyền tài khoản
3. Gửi lại cho người nhờ bạn qua kênh an toàn (không qua Zalo/Slack public):
   - **Account SID**
   - **Restricted API Key SID + Secret** (vừa tạo ở trên)
   - **Số điện thoại +81 đã mua**
   - **SIP Trunk domain** (nếu đã hoàn tất Bước 5)

Sau khi bàn giao, người nhận sẽ tự điền các giá trị này vào cấu hình backend (`.env`) và Retell dashboard.
