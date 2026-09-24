import { useTranslation } from "react-i18next";
import type { CallListItem } from "../api/calls";

interface CallListProps {
  calls: CallListItem[];
  selectedCallId: string | null;
  onSelect: (callId: string) => void;
  isLoading: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  ended: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  dialing: "bg-slate-100 text-slate-700",
  invalid_number: "bg-red-100 text-red-700",
  no_answer: "bg-amber-100 text-amber-700",
  not_interested: "bg-amber-100 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CallList({ calls, selectedCallId, onSelect, isLoading }: CallListProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return <p className="text-sm text-slate-500">{t("callList.loading")}</p>;
  }
  if (calls.length === 0) {
    return <p className="text-sm text-slate-500">{t("callList.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">{t("callList.colTime")}</th>
            <th className="px-4 py-2.5">{t("callList.colLead")}</th>
            <th className="px-4 py-2.5">{t("callList.colStatus")}</th>
            <th className="px-4 py-2.5">{t("callList.colDuration")}</th>
            <th className="px-4 py-2.5">{t("callList.colTransfer")}</th>
            <th className="px-4 py-2.5">{t("callList.colConfidence")}</th>
            <th className="px-4 py-2.5">{t("callList.colRecording")}</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr
              key={call.call_id}
              onClick={() => onSelect(call.call_id)}
              className={
                call.call_id === selectedCallId
                  ? "cursor-pointer border-b border-slate-100 bg-indigo-50 last:border-0"
                  : "cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              }
            >
              <td className="px-4 py-2.5 text-slate-700">
                {call.started_at ? new Date(call.started_at).toLocaleString("vi-VN") : "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-900">
                {call.lead_name}
                <div className="text-xs text-slate-500">{call.lead_phone}</div>
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-4 py-2.5 text-slate-700">{formatDuration(call.duration_seconds)}</td>
              <td className="px-4 py-2.5 text-slate-700">{call.transfer_result ?? "—"}</td>
              <td className="px-4 py-2.5 text-slate-700">
                {call.intent_confidence !== null ? call.intent_confidence.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2.5 text-slate-700">{call.recording_url ? "🎙️" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
