import { useTranslation } from "react-i18next";

interface BehaviorSlidersProps {
  responsiveness: number;
  interruptionSensitivity: number;
  disabled: boolean;
  onResponsivenessChange: (value: number) => void;
  onInterruptionSensitivityChange: (value: number) => void;
}

export function BehaviorSliders({
  responsiveness,
  interruptionSensitivity,
  disabled,
  onResponsivenessChange,
  onInterruptionSensitivityChange,
}: BehaviorSlidersProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-base font-semibold text-fg">{t("agentConfig.behaviorSliders.title")}</h2>
      <p className="text-xs text-fg-subtle">{t("agentConfig.behaviorSliders.defaultNote")}</p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="responsiveness" className="text-sm font-medium text-fg-muted">
            {t("agentConfig.behaviorSliders.responsivenessLabel")}
          </label>
          <span className="text-sm font-medium text-fg">{responsiveness.toFixed(2)}</span>
        </div>
        <input
          id="responsiveness"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={responsiveness}
          disabled={disabled}
          onChange={(e) => onResponsivenessChange(Number(e.target.value))}
          className="w-full accent-accent disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="interruption-sensitivity" className="text-sm font-medium text-fg-muted">
            {t("agentConfig.behaviorSliders.interruptionSensitivityLabel")}
          </label>
          <span className="text-sm font-medium text-fg">{interruptionSensitivity.toFixed(2)}</span>
        </div>
        <input
          id="interruption-sensitivity"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={interruptionSensitivity}
          disabled={disabled}
          onChange={(e) => onInterruptionSensitivityChange(Number(e.target.value))}
          className="w-full accent-accent disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
