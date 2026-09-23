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
    <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
        ⚠️ Dev/Test only — không dùng khi demo khách hàng
      </span>
      <form onSubmit={handleCreateAndDial} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 min-w-50 flex-col gap-1 text-sm text-slate-700">
          Số điện thoại (phải nằm trong whitelist)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+84900000000"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="flex flex-1 min-w-40 flex-col gap-1 text-sm text-slate-700">
          Tên lead
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Khach Test"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Ngôn ngữ
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ja">Tiếng Nhật</option>
            <option value="vi">Tiếng Việt</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Đang xử lý…" : "Tạo lead + Dial"}
        </button>
      </form>
      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
