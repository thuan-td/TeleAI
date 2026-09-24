import { useTranslation } from "react-i18next";
import { Textarea } from "../ui/Textarea";
import { TextInput } from "../ui/TextInput";

interface PromptEditorProps {
  generalPrompt: string;
  beginMessage: string;
  disabled: boolean;
  onGeneralPromptChange: (value: string) => void;
  onBeginMessageChange: (value: string) => void;
}

export function PromptEditor({
  generalPrompt,
  beginMessage,
  disabled,
  onGeneralPromptChange,
  onBeginMessageChange,
}: PromptEditorProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">{t("agentConfig.promptEditor.title")}</h2>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="begin-message" className="text-sm font-medium text-slate-700">
            {t("agentConfig.promptEditor.beginMessageLabel")}
          </label>
          <span className="text-xs text-slate-400">
            {t("agentConfig.promptEditor.charCount", { count: beginMessage.length })}
          </span>
        </div>
        <TextInput
          id="begin-message"
          value={beginMessage}
          disabled={disabled}
          onChange={(e) => onBeginMessageChange(e.target.value)}
          placeholder={t("agentConfig.promptEditor.beginMessagePlaceholder")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="general-prompt" className="text-sm font-medium text-slate-700">
            {t("agentConfig.promptEditor.generalPromptLabel")}
          </label>
          <span className="text-xs text-slate-400">
            {t("agentConfig.promptEditor.charCount", { count: generalPrompt.length })}
          </span>
        </div>
        <Textarea
          id="general-prompt"
          rows={16}
          value={generalPrompt}
          disabled={disabled}
          onChange={(e) => onGeneralPromptChange(e.target.value)}
          className="w-full font-mono"
          placeholder={t("agentConfig.promptEditor.generalPromptPlaceholder")}
        />
      </div>
    </div>
  );
}
