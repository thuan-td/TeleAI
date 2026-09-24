import { useTranslation } from "react-i18next";

const RETELL_LANGUAGE_OPTIONS = ["vi-VN", "ja-JP", "en-US"] as const;

interface LanguagePickerProps {
  language: string;
  onLanguageChange: (value: string) => void;
}

export function LanguagePicker({ language, onLanguageChange }: LanguagePickerProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-base font-semibold text-slate-900">{t("agentConfig.languagePicker.title")}</h2>
      <p className="text-xs text-slate-500">{t("agentConfig.languagePicker.note")}</p>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      >
        {!RETELL_LANGUAGE_OPTIONS.includes(language as (typeof RETELL_LANGUAGE_OPTIONS)[number]) && (
          <option value={language}>{language}</option>
        )}
        {RETELL_LANGUAGE_OPTIONS.map((lang) => (
          <option key={lang} value={lang}>
            {t(`agentConfig.languagePicker.options.${lang}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
