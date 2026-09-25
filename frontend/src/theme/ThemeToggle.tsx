import { useTranslation } from "react-i18next";
import { useTheme, type ThemeMode } from "./ThemeProvider";

const MODES: { mode: ThemeMode; icon: string }[] = [
  { mode: "light", icon: "☀" },
  { mode: "dark", icon: "☾" },
  { mode: "system", icon: "💻" },
];

/** 3-way light/dark/system segmented control. Placed in AppLayout's header
 * next to the language switcher — same visual pattern (segmented pill). */
export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      className="flex gap-1 rounded-md border border-border p-0.5"
      role="group"
      aria-label={t("theme.toggleLabel")}
    >
      {MODES.map(({ mode: m, icon }) => {
        const isActive = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={isActive}
            title={t(`theme.${m}`)}
            className={
              isActive
                ? "rounded px-2.5 py-1 text-xs font-medium bg-accent text-accent-fg"
                : "rounded px-2.5 py-1 text-xs font-medium text-fg-muted hover:bg-surface-sunken"
            }
          >
            <span aria-hidden="true">{icon}</span>
            <span className="sr-only">{t(`theme.${m}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
