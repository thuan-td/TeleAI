import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type CallState = "idle" | "connecting" | "active" | "ended" | "error";

interface CallTesterShellProps {
  badgeLabel: string;
  description: ReactNode;
  callState: CallState;
  errorMessage: string | null;
  onStart: () => void;
  onStop: () => void;
  children?: ReactNode;
}

export function CallTesterShell({
  badgeLabel,
  description,
  callState,
  errorMessage,
  onStart,
  onStop,
  children,
}: CallTesterShellProps) {
  const { t } = useTranslation();
  const isBusy = callState === "connecting" || callState === "active";
  const stateLabel = t(`callTesterShell.state.${callState}`);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-warning px-3 py-1 text-xs font-semibold uppercase tracking-wide text-fg-on-accent">
        ⚠️ {badgeLabel}
      </span>
      <p className="text-sm text-fg-muted">{description}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("callTesterShell.startButton")}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isBusy}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-fg-muted hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("callTesterShell.stopButton")}
        </button>
      </div>
      <p className="text-sm text-fg-muted">
        {t("callTesterShell.status")} <span className="font-medium text-fg">{stateLabel}</span>
      </p>
      {errorMessage && (
        <p className="rounded-md border border-danger-border bg-danger-surface px-4 py-2 text-sm text-danger-fg">
          {t("callTesterShell.errorPrefix")} {errorMessage}
        </p>
      )}
      {children}
    </div>
  );
}
