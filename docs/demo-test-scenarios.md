# Kịch bản test trước demo client — Agent Sato (BDS Tokyo)

**Ngày chuẩn bị:** 2026-09-29
**Kênh test:** Web Call Tester (Retell hoặc OpenAI Realtime) tại `http://localhost:5173/web-call-test` hoặc `/web-call-test-openai`

## Trạng thái Knowledge Base

Đã dọn 2 tài liệu cũ không khớp kịch bản (BDS TP.HCM, test rác) và thêm 8 tài liệu mới:

- 6 tài liệu text: giá căn hộ Tokyo, vay mua nhà người nước ngoài, quản lý cho thuê, dự án tái phát triển đô thị (Shibuya/Toranomon/Shinagawa), dự án phát triển Chiba, quy trình làm việc
- 2 tài liệu từ ảnh (test OCR pipeline): bảng giá thuê theo khu vực, sơ đồ mặt bằng căn hộ mẫu

**Đã fix (2026-09-30):** tìm kiếm KB dùng Postgres full-text search config `'simple'` — trước đó dùng `websearch_to_tsquery` (AND logic: TOÀN BỘ từ trong câu phải khớp), khiến câu hỏi tự nhiên dài (nhiều từ đệm như "có...không", "như thế nào", "bao nhiêu") trả về RỖNG dù từ khóa chính có trong KB. Đã đổi sang OR logic (lọc bỏ stopword tiếng Việt phổ biến, nối các từ khóa còn lại bằng `|`) — xem `backend/app/routers/kb.py::_build_or_tsquery`. Verify: 3 câu hỏi B1/B3/B4/B5 từng trả rỗng nay đều có kết quả đúng, test hồi quy `test_query_documents_natural_language_question_still_matches_keyword` trong `test_kb.py`.

## A. Câu hỏi khớp kịch bản gốc (`general_prompt` hiện có)

Mục đích: xác nhận agent bám đúng script, không lệch persona.

| #   | Câu hỏi                                       | Kỳ vọng                                                                                            |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| A1  | "Anh/chị gọi tôi có việc gì vậy?"             | Giới thiệu bản thân là Sato, nhân viên telesale BĐS Tokyo Property Partners, nêu mục đích cuộc gọi |
| A2  | "Tôi đang muốn bán căn hộ, có nên bán không?" | Nhắc tới nhu cầu cao khu vực Tokyo do tái phát triển, giá bán tốt hơn mặt bằng chung               |
| A3  | "Tôi muốn mua nhà ở Tokyo"                    | Nhắc thông tin BĐS chưa công khai + lãi suất vay thấp hiện tại                                     |
| A4  | "Tôi có nhà cho thuê, có dịch vụ gì không?"   | Nhắc gói tư vấn lợi nhuận cao, hạn chế rủi ro trống phòng                                          |
| A5  | "Bạn có phải AI không?"                       | Không thừa nhận là AI, giữ vai Sato                                                                |

## B. Câu hỏi cần tra Knowledge Base mới (test tính năng KB thật sự có tác dụng)

Mục đích: xác nhận agent gọi được `query_knowledge_base` và trả lời có thông tin cụ thể mà `general_prompt` KHÔNG có sẵn.

| #   | Câu hỏi                                                | Kỳ vọng                                                                         | Test riêng KB trước (curl)                                              |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| B1  | "Giá thuê căn hộ ở Chiba khoảng bao nhiêu?"            | Nêu được khoảng giá 70.000-110.000 yên/tháng (khu ngoại ô giáp Tokyo)           | Đã verify: query "Chiba" → 2 kết quả đúng (giá + dự án Chiba)           |
| B2  | "Người nước ngoài có vay mua nhà được không?"          | Nêu điều kiện: visa dài hạn, thu nhập tối thiểu, lãi suất 0.5-1.5%              | Đã verify: query "vay mua nhà có cần vĩnh trú không" → match đúng       |
| B3  | "Công ty có quản lý cho thuê hộ không, phí bao nhiêu?" | Nêu phí quản lý 5%, tỷ lệ lấp đầy 90-95%                                        | Đã verify: câu hỏi nguyên văn → 3 kết quả, top-1 đúng chủ đề            |
| B4  | "Khu Chiba có dự án gì đang xây không?"                 | Nhắc dự án Makuhari Bay Park + cải tạo ga Chiba, tăng giá 5-15% trong 3-5 năm  | Đã verify: câu hỏi nguyên văn → 3 kết quả, top-1 đúng chủ đề            |
| B5  | "Căn hộ 2 phòng ngủ 65m2 bố trí như thế nào?"          | Mô tả các phòng: khách, 2 phòng ngủ, bếp, nhà tắm, ban công (từ ảnh floor-plan) | Đã verify: câu hỏi nguyên văn → 3 kết quả, gồm cả tài liệu floor-plan   |

## C. Câu hỏi test "Ưu tiên tuyệt đối" khi khách từ chối

Mục đích: xác nhận agent dừng NGAY, không giải thích thêm, không cố thuyết phục — đây là quy tắc ưu tiên cao nhất trong prompt.

| #   | Kịch bản                                                                                     | Kỳ vọng                                                                   |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| C1  | Đang giữa câu agent giải thích, ngắt lời nói "tôi đang bận"                                  | Agent dừng ngay, chào tạm biệt lịch sự, KHÔNG giải thích thêm             |
| C2  | "Tôi không quan tâm đâu"                                                                     | Thể hiện đã hiểu, xin lỗi vì làm phiền, kết thúc — không lặp lại kịch bản |
| C3  | Sau khi từ chối ở C1/C2, hỏi tiếp 1 câu về giá (test xem agent có "quên" quy tắc dừng không) | Agent vẫn giữ trạng thái đã kết thúc/từ chối, không quay lại thuyết phục  |

## D. Câu hỏi ngoài phạm vi (test agent không bịa thông tin)

Mục đích: xác nhận agent thừa nhận không biết thay vì bịa số liệu.

| #   | Câu hỏi                                          | Kỳ vọng                                                     |
| --- | ------------------------------------------------ | ----------------------------------------------------------- |
| D1  | "Giá vàng hôm nay bao nhiêu?"                    | Thừa nhận không nắm rõ, lái về mục tiêu chính (nhu cầu BĐS) |
| D2  | "Căn hộ số 501 tòa ABC giá chính xác bao nhiêu?" | Không bịa giá cụ thể — đề xuất chuyển máy cho chuyên viên   |
| D3  | "Công ty có bao nhiêu nhân viên?"                | Thừa nhận không có thông tin đó, lái về chủ đề chính        |

## E. Câu hỏi chuyển máy (test luồng chuyển tiếp)

| #   | Câu hỏi                                                                      | Kỳ vọng                                                               |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| E1  | "Để tôi nghe chi tiết hơn, chuyển máy giúp tôi"                              | Xác nhận, cảm ơn, thông báo chuyển máy cho chuyên viên khu vực Tokyo  |
| E2  | Sau khi hỏi B2 (vay mua nhà) rồi nói "cho tôi gặp chuyên viên tư vấn kỹ hơn" | Đề xuất chuyển máy đúng như quy trình ở tài liệu "Quy trình làm việc" |

## Ghi chú khi chạy demo thật

- Xem `knowledge_base_enabled` đã bật cho agent Retell chưa: `GET /agent/config` → field `knowledge_base_enabled`.
- Nếu dùng OpenAI Realtime tab, xác nhận `openai_realtime_prompt` cũng đã cập nhật đồng bộ với `general_prompt` (2 bản riêng biệt, phải sửa cả 2 nếu đổi kịch bản).
- Sau mỗi câu hỏi nhóm C, nên bắt đầu cuộc gọi MỚI cho câu hỏi tiếp theo (đừng test liên tục trong 1 cuộc gọi) để tránh nhiễu ngữ cảnh hội thoại trước đó.
