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
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {t("agentConfig.saveResult.saveErrorPrefix")} {saveError}
        </p>
      )}

      {saveResult && !saveResult.published && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t("agentConfig.saveResult.savedNotPublished", {
            reason: saveResult.publish_error ?? t("agentConfig.saveResult.publishFailedFallback"),
          })}
        </p>
      )}

      {saveResult && saveResult.published && (
        <p className="rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
          {t("agentConfig.saveResult.savedAndPublished")}
        </p>
      )}
    </>
  );
}
