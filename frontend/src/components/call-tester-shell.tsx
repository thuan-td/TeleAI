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
    <div className="mx-auto flex max-w-xl flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
        ⚠️ {badgeLabel}
      </span>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onStart}
          disabled={isBusy}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("callTesterShell.startButton")}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!isBusy}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("callTesterShell.stopButton")}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        {t("callTesterShell.status")} <span className="font-medium text-slate-900">{stateLabel}</span>
      </p>
      {errorMessage && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {t("callTesterShell.errorPrefix")} {errorMessage}
        </p>
      )}
      {children}
    </div>
  );
}
