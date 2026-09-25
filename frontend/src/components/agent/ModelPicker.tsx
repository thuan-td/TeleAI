import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";

interface ModelPickerProps {
  models: string[];
  selectedModel: string;
  variant?: "default" | "purple";
  onSelect: (model: string) => void;
}

/** Shared model dropdown for both Retell (`model` field) and OpenAI Realtime
 * (`openai_realtime_model`) — same UI, different allowed-model list per
 * provider (backend validates against RETELL_MODELS / OPENAI_REALTIME_MODELS
 * respectively, both verified live against each provider's real API,
 * 2026-09-24). */
export function ModelPicker({ models, selectedModel, variant = "default", onSelect }: ModelPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="model-picker" className="text-sm font-medium text-fg-muted">
        {t("agentConfig.modelPicker.label")}
      </label>
      <Select id="model-picker" value={selectedModel} variant={variant} onChange={(e) => onSelect(e.target.value)}>
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </Select>
    </div>
  );
}
