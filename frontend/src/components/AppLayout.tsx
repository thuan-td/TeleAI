import type { ReactNode } from "react";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Call Monitor", href: "/" },
  { label: "Retell Web Call Test", href: "/web-call-test" },
  { label: "OpenAI Web Call Test", href: "/web-call-test-openai" },
];

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const currentPath = window.location.pathname;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="text-sm font-semibold tracking-wide text-slate-900">
            TeleApo Clone
          </span>
          <nav className="flex flex-wrap gap-1">
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
                  {item.label}
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
