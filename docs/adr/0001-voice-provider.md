# ADR 0001 — Voice provider: Retell AI transfer là dashboard-config, không phải REST API

**Trạng thái:** Confirmed (2026-09-22, research chính thức docs.retellai.com)
**Liên quan:** TD4 (warm-transfer pattern), TD7 (Retell AI), plan.md, phase-1-mvp-core.md task 1.D

## Bối cảnh

Plan gốc giả định backend chủ động gọi API để trigger warm-transfer (pattern Room-Participant hoặc native transfer API), đo `context_sent_at < audio_bridge_started_at` bằng cách tự backend gửi context rồi mới gọi transfer.

## Phát hiện qua research chính thức

Retell AI **không có REST endpoint để trigger transfer**. Cơ chế thật:

- Transfer được cấu hình như 1 "Transfer Call Tool" ngay trên Agent Flow, qua **Retell dashboard** — không phải qua code.
- Agent (AI) tự quyết định khi nào transfer trong lúc hội thoại đang diễn ra, dựa trên logic đã cấu hình.
- Retell **tự động** gửi transcript đầy đủ + 1 bản tóm tắt AI (whisper message) cho người nhận TRƯỚC khi bridge audio — không cần backend tự làm việc này.
- Backend chỉ **quan sát** qua webhook (`transfer_started`, `transfer_bridged`, `transfer_cancelled`, `transfer_ended`), không điều khiển.

Nguồn: [Transfer call tool — Retell AI docs](https://docs.retellai.com/build/single-multi-prompt/transfer-call), [Webhook overview — Retell AI docs](https://docs.retellai.com/features/webhook-overview)

## Quyết định

1. `RetellAdapter.transfer()` raise `NotImplementedError` rõ ràng — không âm thầm gọi endpoint không tồn tại.
2. Backend chỉ ghi nhận `context_sent_at` khi nhận webhook `transfer_started`, `audio_bridge_started_at` khi nhận `transfer_bridged`. AC3 ("context gửi trước khi bridge") vẫn đo được đúng thứ tự — nhưng ý nghĩa đổi từ "backend chủ động gửi trước" sang "backend xác nhận Retell đã gửi trước khi bridge", vì chính Retell đảm nhiệm việc gửi context.
3. Transfer target (số/route đích) phải cấu hình trực tiếp trên Retell dashboard (Agent → Transfer Call Tool), KHÔNG qua env var `SALES_TRANSFER_TARGET` (đã xoá khỏi `Settings`).
4. `flag_low_confidence_for_review()` thay thế `evaluate_transfer()` cũ — chỉ ghi log review nội bộ khi confidence thấp (AC11), không còn ý nghĩa "quyết định có transfer hay không" vì quyết định đó nay thuộc về Agent trên dashboard.
5. `end_call()` — KHÔNG tìm thấy endpoint chính thức trong docs. Đánh dấu `NotImplementedError`, cần hỏi Retell support trước khi dùng thật.

## Hệ quả

- Kiến trúc "Room-Participant" (TD4) không cần thiết cho MVP — Retell native transfer đã đủ, không phải tự build WebRTC bridge.
- Câu hỏi treo cũ ở phase-1-mvp-core.md ("Retell native transfer có truyền context không") → **đã trả lời: CÓ, tự động.**
- MockVoiceProvider giữ nguyên hành vi transfer cũ (dùng cho test), nhưng payload webhook mock đã đổi theo format Retell thật (`call.call_analysis.intent_confidence` thay vì `call.intent_confidence` phẳng).
