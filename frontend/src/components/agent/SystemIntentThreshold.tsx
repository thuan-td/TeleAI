import { useTranslation } from "react-i18next";

interface SystemIntentThresholdProps {
  value: number;
  onChange: (value: number) => void;
}

export function SystemIntentThreshold({ value, onChange }: SystemIntentThresholdProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50 p-6">
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
    </div>
  );
}
