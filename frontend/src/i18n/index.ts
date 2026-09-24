import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import vi from "./locales/vi.json";

export const LANG_STORAGE_KEY = "teleapo-ui-lang";
export const SUPPORTED_LANGUAGES = ["vi", "en", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function getStoredLanguage(): SupportedLanguage {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to default.
  }
  return "vi";
}

export function setStoredLanguage(lang: SupportedLanguage): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore write failures; language just won't persist across reloads.
  }
}

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: getStoredLanguage(),
  fallbackLng: "vi",
  interpolation: { escapeValue: false },
});

export default i18n;
