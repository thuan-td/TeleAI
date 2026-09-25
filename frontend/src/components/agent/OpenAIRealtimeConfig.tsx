import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { ModelPicker } from "./ModelPicker";

const OPENAI_LANGUAGE_OPTIONS = ["vi", "ja", "en"] as const;

// Verified live (2026-09-24) against GET https://api.openai.com/v1/models —
// see backend/app/services/app_settings.py OPENAI_REALTIME_MODELS.
const OPENAI_REALTIME_MODELS = [
  "gpt-realtime",
  "gpt-realtime-1.5",
  "gpt-realtime-2",
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
  "gpt-realtime-mini",
];

// Gender hints are NOT official OpenAI metadata — OpenAI documents no
// gender/accent info for these voices. Based only on scattered community
// forum comments (see research 2026-09-24), hence "unknown" for most.
// Never treat as authoritative; UI must show the low-confidence disclaimer.
const OPENAI_VOICE_OPTIONS: { id: string; genderHint: "male" | "female" | "unknown" }[] = [
  { id: "alloy", genderHint: "female" },
  { id: "ash", genderHint: "male" },
  { id: "ballad", genderHint: "unknown" },
  { id: "coral", genderHint: "unknown" },
  { id: "echo", genderHint: "female" },
  { id: "sage", genderHint: "unknown" },
  { id: "shimmer", genderHint: "female" },
  { id: "verse", genderHint: "unknown" },
  { id: "marin", genderHint: "female" },
  { id: "cedar", genderHint: "unknown" },
];

interface OpenAIRealtimeConfigProps {
  language: string;
  onLanguageChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  voice: string;
  onVoiceChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
}

export function OpenAIRealtimeConfig({
  language,
  onLanguageChange,
  prompt,
  onPromptChange,
  voice,
  onVoiceChange,
  model,
  onModelChange,
}: OpenAIRealtimeConfigProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5 rounded-lg border-2 border-dashed border-accent-experimental-border bg-accent-experimental-surface p-6">
      <h2 className="text-base font-semibold text-accent-experimental-fg">
        {t("agentConfig.openaiRealtimeLanguage.title")}
      </h2>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="openai-prompt" className="text-sm font-medium text-accent-experimental-fg">
          {t("agentConfig.openaiRealtimePrompt.label")}
        </label>
        <p className="text-xs text-accent-experimental-fg opacity-80">{t("agentConfig.openaiRealtimePrompt.note")}</p>
        <Textarea
          id="openai-prompt"
          variant="purple"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={t("agentConfig.openaiRealtimePrompt.placeholder")}
          rows={5}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="openai-voice" className="text-sm font-medium text-accent-experimental-fg">
          {t("agentConfig.openaiRealtimeVoice.label")}
        </label>
        <p className="text-xs text-accent-experimental-fg opacity-80">{t("agentConfig.openaiRealtimeVoice.note")}</p>
        <Select id="openai-voice" variant="purple" value={voice} onChange={(e) => onVoiceChange(e.target.value)}>
          {OPENAI_VOICE_OPTIONS.map(({ id, genderHint }) => (
            <option key={id} value={id}>
              {id} ({t(`agentConfig.openaiRealtimeVoice.genderHints.${genderHint}`)})
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="openai-language" className="text-sm font-medium text-accent-experimental-fg">
          {t("agentConfig.openaiRealtimeLanguage.label")}
        </label>
        <p className="text-xs text-accent-experimental-fg opacity-80">
          {t("agentConfig.openaiRealtimeLanguage.note")}
        </p>
        <Select
          id="openai-language"
          variant="purple"
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          {OPENAI_LANGUAGE_OPTIONS.map((lang) => (
            <option key={lang} value={lang}>
              {t(`agentConfig.openaiRealtimeLanguage.options.${lang}`)}
            </option>
          ))}
        </Select>
      </div>

      <ModelPicker models={OPENAI_REALTIME_MODELS} selectedModel={model} variant="purple" onSelect={onModelChange} />
    </div>
  );
}
