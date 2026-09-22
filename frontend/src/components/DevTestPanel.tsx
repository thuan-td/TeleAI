import { useState } from "react";
import { dialCall } from "../api/calls";
import { createLead } from "../api/leads";

interface DevTestPanelProps {
  onCallCreated: () => void;
}

export function DevTestPanel({ onCallCreated }: DevTestPanelProps) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("ja");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAndDial = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);
    try {
      const lead = await createLead({ phone, name, lang });
      const call = await dialCall(lead.id);
      setStatus(`Đã tạo lead + dial thành công: call_id=${call.call_id}`);
      setPhone("");
      setName("");
      onCallCreated();
    } catch (err) {
      setStatus(`Lỗi: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dev-test-panel">
      <h2>⚠️ Dev/Test only — không dùng khi demo khách hàng</h2>
      <form onSubmit={handleCreateAndDial}>
        <label>
          Số điện thoại (phải nằm trong whitelist)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+84900000000" required />
        </label>
        <label>
          Tên lead
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Khach Test" required />
        </label>
        <label>
          Ngôn ngữ
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ja">Tiếng Nhật</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Đang xử lý…" : "Tạo lead + Dial"}
        </button>
      </form>
      {status && <p className="dev-test-status">{status}</p>}
    </div>
  );
}
