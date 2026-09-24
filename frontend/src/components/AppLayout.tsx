import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { setStoredLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

interface NavItem {
  labelKey: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.callMonitor", href: "/" },
  { labelKey: "nav.leads", href: "/leads" },
  { labelKey: "nav.retellWebCallTest", href: "/web-call-test" },
  { labelKey: "nav.openaiWebCallTest", href: "/web-call-test-openai" },
  { labelKey: "nav.agentConfig", href: "/agent-config" },
];

interface AppLayoutProps {
  children: ReactNode;
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  function handleChange(lang: SupportedLanguage) {
    i18n.changeLanguage(lang);
    setStoredLanguage(lang);
  }

  return (
    <div className="flex gap-1 rounded-md border border-slate-200 p-0.5">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => handleChange(lang)}
            className={
              isActive
                ? "rounded px-2.5 py-1 text-xs font-medium bg-indigo-600 text-white"
                : "rounded px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            }
          >
            {t(`language.${lang}`)}
          </button>
        );
      })}
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm font-semibold tracking-wide text-slate-900">
            {t("common.appName")}
          </span>
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }
                >
                  {t(item.labelKey)}
                </a>
              );
            })}
            <LanguageSwitcher />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
