import { useTranslation } from "react-i18next";
import { Select } from "../ui/Select";

const RETELL_LANGUAGE_OPTIONS = ["vi-VN", "ja-JP", "en-US"] as const;

interface LanguagePickerProps {
  language: string;
  onLanguageChange: (value: string) => void;
}

export function LanguagePicker({ language, onLanguageChange }: LanguagePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-6">
      <h2 className="text-base font-semibold text-fg">{t("agentConfig.languagePicker.title")}</h2>
      <p className="text-xs text-fg-subtle">{t("agentConfig.languagePicker.note")}</p>
      <Select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
        {!RETELL_LANGUAGE_OPTIONS.includes(language as (typeof RETELL_LANGUAGE_OPTIONS)[number]) && (
          <option value={language}>{language}</option>
        )}
        {RETELL_LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>
            {t(`agentConfig.languagePicker.options.${lang}`)}
          </option>
        ))}
      </Select>
    </div>
  );
}
