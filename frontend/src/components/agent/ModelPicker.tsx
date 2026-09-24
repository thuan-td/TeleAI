import { useTranslation } from "react-i18next";

interface ModelPickerProps {
  models: string[];
  selectedModel: string;
  variant?: "default" | "purple";
  onSelect: (model: string) => void;
}

const VARIANT_CLASSES = {
  default:
    "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
  purple:
    "rounded-md border border-purple-300 bg-white px-3 py-2 text-sm text-purple-900 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500",
} as const;

/** Shared model dropdown for both Retell (`model` field) and OpenAI Realtime
 * (`openai_realtime_model`) — same UI, different allowed-model list per
 * provider (backend validates against RETELL_MODELS / OPENAI_REALTIME_MODELS
 * respectively, both verified live against each provider's real API,
 * 2026-09-24). */
export function ModelPicker({ models, selectedModel, variant = "default", onSelect }: ModelPickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="model-picker" className="text-sm font-medium text-slate-700">
        {t("agentConfig.modelPicker.label")}
      </label>
      <select
        id="model-picker"
        value={selectedModel}
        onChange={(e) => onSelect(e.target.value)}
        className={VARIANT_CLASSES[variant]}
      >
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}
