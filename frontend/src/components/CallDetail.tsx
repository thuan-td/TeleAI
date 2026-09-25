import { useTranslation } from "react-i18next";
import type { CallDetail as CallDetailData } from "../api/calls";
import { AudioPlayer } from "./AudioPlayer";

interface CallDetailProps {
  call: CallDetailData | null;
  isLoading: boolean;
}

export function CallDetail({ call, isLoading }: CallDetailProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 text-sm text-fg-subtle">
        {t("common.loading")}
      </div>
    );
  }
  if (!call) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 text-sm text-fg-subtle">
        {t("callDetail.emptyState")}
      </div>
    );
  }

  const lowConfidence = call.intent_confidence !== null && call.intent_confidence < 0.7;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4">
      <h2 className="text-base font-semibold text-fg">{call.call_id}</h2>
      <p className="text-sm text-fg-muted">
        {t("callDetail.lead")} <span className="font-medium text-fg">{call.lead_name} ({call.lead_phone})</span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.status")} <span className="font-medium text-fg">{call.status}</span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.startedAt")}{" "}
        <span className="font-medium text-fg">
          {call.started_at ? new Date(call.started_at).toLocaleString("vi-VN") : "—"}
        </span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.endedAt")}{" "}
        <span className="font-medium text-fg">
          {call.ended_at ? new Date(call.ended_at).toLocaleString("vi-VN") : "—"}
        </span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.duration")}{" "}
        <span className="font-medium text-fg">
          {call.duration_seconds !== null ? `${call.duration_seconds}s` : "—"}
        </span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.transfer")} <span className="font-medium text-fg">{call.transfer_result ?? "—"}</span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.confidence")}{" "}
        <span className={lowConfidence ? "font-medium text-warning-fg" : "font-medium text-fg"}>
          {call.intent_confidence !== null ? call.intent_confidence.toFixed(2) : "—"}
          {lowConfidence && ` (${t("callDetail.lowConfidenceWarning")})`}
        </span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.retryCount")} <span className="font-medium text-fg">{call.retry_count}</span>
      </p>
      <p className="text-sm text-fg-muted">
        {t("callDetail.transcriptStatus")}{" "}
        <span className="font-medium text-fg">{call.transcript_status}</span>
      </p>
      <AudioPlayer recordingUrl={call.recording_url} />
      <div>
        <p className="mb-1 text-sm font-medium text-fg-muted">{t("callDetail.transcript")}</p>
        {call.transcript ? (
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-sunken p-3 text-sm text-fg">
            {call.transcript}
          </div>
        ) : (
          <p className="text-sm italic text-fg-subtle">{t("callDetail.noTranscript")}</p>
        )}
      </div>
    </div>
  );
}
