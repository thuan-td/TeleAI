import { useTranslation } from "react-i18next";

const OPENAI_LANGUAGE_OPTIONS = ["vi", "ja", "en"] as const;

interface SystemIntentThresholdProps {
  value: number;
  onChange: (value: number) => void;
  openaiLanguage: string;
  onOpenaiLanguageChange: (value: string) => void;
}

export function SystemIntentThreshold({
  value,
  onChange,
  openaiLanguage,
  onOpenaiLanguageChange,
}: SystemIntentThresholdProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-6">
      <h2 className="text-base font-semibold text-purple-900">{t("agentConfig.systemIntentThreshold.title")}</h2>
      <p className="text-xs text-purple-700">{t("agentConfig.systemIntentThreshold.note")}</p>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="intent-threshold" className="text-sm font-medium text-purple-900">
            {t("agentConfig.systemIntentThreshold.thresholdLabel")}
          </label>
          <span className="text-sm font-medium text-purple-900">{value.toFixed(2)}</span>
        </div>
        <input
          id="intent-threshold"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-purple-600"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="openai-language" className="text-sm font-medium text-purple-900">
          {t("agentConfig.openaiRealtimeLanguage.label")}
        </label>
        <p className="text-xs text-purple-700">{t("agentConfig.openaiRealtimeLanguage.note")}</p>
        <select
          id="openai-language"
          value={openaiLanguage}
          onChange={(e) => onOpenaiLanguageChange(e.target.value)}
          className="rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-purple-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        >
          {OPENAI_LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>
              {t(`agentConfig.openaiRealtimeLanguage.options.${lang}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
