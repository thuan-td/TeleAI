import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { logout, type CurrentUser } from "../api/client";
import { setStoredLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";
import { ThemeToggle } from "../theme/ThemeToggle";

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

interface AppLayoutProps {
  children: ReactNode;
  user: CurrentUser;
}

function UserMenu({ user }: { user: CurrentUser }) {
  const { t } = useTranslation();

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-fg-muted">{user.username}</span>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-md px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-sunken hover:text-fg"
      >
        {t("auth.logout")}
      </button>
    </div>
  );
}

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  function handleChange(lang: SupportedLanguage) {
    i18n.changeLanguage(lang);
    setStoredLanguage(lang);
  }

  return (
    <div className="flex gap-1 rounded-md border border-border p-0.5">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <button
            key={lang}
            type="button"
            onClick={() => handleChange(lang)}
            className={
              isActive
                ? "rounded px-2.5 py-1 text-xs font-medium bg-accent text-accent-fg"
                : "rounded px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-sunken"
            }
          >
            {t(`language.${lang}`)}
          </button>
        );
      })}
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
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-fg">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-fg">
                T
              </span>
              {t("common.appName")}
            </span>
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
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
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
