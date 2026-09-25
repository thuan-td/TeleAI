import { useTranslation } from "react-i18next";
import type { CallListItem } from "../api/calls";

interface CallListProps {
  calls: CallListItem[];
  selectedCallId: string | null;
  onSelect: (callId: string) => void;
  isLoading: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  ended: "bg-success-surface text-success-fg border border-success-border",
  failed: "bg-danger-surface text-danger-fg border border-danger-border",
  in_progress: "bg-info-surface text-info-fg border border-info-border",
  dialing: "bg-surface-sunken text-fg-muted border border-border",
  invalid_number: "bg-danger-surface text-danger-fg border border-danger-border",
  no_answer: "bg-warning-surface text-warning-fg border border-warning-border",
  not_interested: "bg-warning-surface text-warning-fg border border-warning-border",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? "bg-surface-sunken text-fg-muted border border-border";
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
    return <p className="text-sm text-fg-subtle">{t("callList.loading")}</p>;
  }
  if (calls.length === 0) {
    return <p className="text-sm text-fg-subtle">{t("callList.empty")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface-raised">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-sunken text-xs uppercase tracking-wide text-fg-subtle">
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
                  ? "cursor-pointer border-b border-border bg-accent/10 last:border-0"
                  : "cursor-pointer border-b border-border last:border-0 hover:bg-surface-sunken/60"
              }
            >
              <td className="px-4 py-2.5 text-fg-muted">
                {call.started_at ? new Date(call.started_at).toLocaleString("vi-VN") : "—"}
              </td>
              <td className="px-4 py-2.5 font-medium text-fg">
                {call.lead_name}
                <div className="text-xs font-normal text-fg-subtle">{call.lead_phone}</div>
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-4 py-2.5 text-fg-muted">{formatDuration(call.duration_seconds)}</td>
              <td className="px-4 py-2.5 text-fg-muted">{call.transfer_result ?? "—"}</td>
              <td className="px-4 py-2.5 text-fg-muted">
                {call.intent_confidence !== null ? call.intent_confidence.toFixed(2) : "—"}
              </td>
              <td className="px-4 py-2.5 text-fg-muted">{call.recording_url ? "🎙️" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
