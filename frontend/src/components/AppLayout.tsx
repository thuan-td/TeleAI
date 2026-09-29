import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { logout, type CurrentUser } from "../api/client";
import { setStoredLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";
import { Select } from "./ui/Select";

const LANGUAGE_SHORT_LABELS: Record<SupportedLanguage, string> = {
  vi: "vi",
  en: "en",
  ja: "jp",
};

interface NavItem {
  labelKey: string;
  href: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: "nav.callMonitor", href: "/" },
  { labelKey: "nav.leads", href: "/leads" },
  { labelKey: "nav.retellWebCallTest", href: "/web-call-test", adminOnly: true },
  { labelKey: "nav.openaiWebCallTest", href: "/web-call-test-openai", adminOnly: true },
  { labelKey: "nav.agentConfig", href: "/agent-config", adminOnly: true },
];

const THEME_MODES: ThemeMode[] = ["light", "dark", "system"];

interface AppLayoutProps {
  children: ReactNode;
  user: CurrentUser;
}

/** Single dropdown replacing the previously separate theme toggle, language
 * switcher, and user badge — keeps the header to 2 rows (logo+utility row,
 * nav row) instead of cramming everything into one wide row. Opens on click,
 * closes on click-outside or Escape. */
function UtilityMenu({ user }: { user: CurrentUser }) {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  function handleLanguageChange(lang: SupportedLanguage) {
    i18n.changeLanguage(lang);
    setStoredLanguage(lang);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-sunken hover:text-fg"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{user.username}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-border bg-surface-raised p-2 shadow-lg"
        >
          <label className="block px-2 pb-1 text-xs font-medium text-fg-subtle">{t("theme.toggleLabel")}</label>
          <Select
            className="mb-2 w-full"
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
          >
            {THEME_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`theme.${m}`)}
              </option>
            ))}
          </Select>

          <div className="my-2 h-px bg-border" />

          <label className="block px-2 pb-1 text-xs font-medium text-fg-subtle">{t("language.toggleLabel")}</label>
          <Select
            className="mb-2 w-full"
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_SHORT_LABELS[lang]}
              </option>
            ))}
          </Select>

          <div className="my-2 h-px bg-border" />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-fg-muted hover:bg-surface-sunken hover:text-fg"
          >
            {t("auth.logout")}
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children, user }: AppLayoutProps) {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || user.role === "admin");

  return (
    <div className="min-h-screen bg-surface text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface-raised/90 backdrop-blur supports-backdrop-filter:bg-surface-raised/75">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-fg">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg">
              T
            </span>
            {t("common.appName")}
          </span>
          <UtilityMenu user={user} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1">
            {visibleNavItems.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-fg-muted hover:bg-surface-sunken hover:text-fg"
                  }
                >
                  {t(item.labelKey)}
                </a>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
