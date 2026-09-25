import { useTranslation } from "react-i18next";
import type { AgentConfigSaveResult } from "../../api/agentConfig";

interface SaveResultBannerProps {
  saveError: string | null;
  saveResult: AgentConfigSaveResult | null;
}

export function SaveResultBanner({ saveError, saveResult }: SaveResultBannerProps) {
  const { t } = useTranslation();
  return (
    <>
      {saveError && (
        <p className="rounded-md border border-danger-border bg-danger-surface px-4 py-2 text-sm text-danger-fg">
          {t("agentConfig.saveResult.saveErrorPrefix")} {saveError}
        </p>
      )}

      {saveResult && !saveResult.published && (
        <p className="rounded-md border border-warning-border bg-warning-surface px-4 py-2 text-sm text-warning-fg">
          {t("agentConfig.saveResult.savedNotPublished", {
            reason: saveResult.publish_error ?? t("agentConfig.saveResult.publishFailedFallback"),
          })}
        </p>
      )}

      {saveResult && saveResult.published && (
        <p className="rounded-md border border-success-border bg-success-surface px-4 py-2 text-sm text-success-fg">
          {t("agentConfig.saveResult.savedAndPublished")}
        </p>
      )}
    </>
  );
}
