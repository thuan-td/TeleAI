# Design Guidelines — TeleApo Clone Frontend

Design system + theme rules for `frontend/`. Read before touching any UI code.
First version, written 2026-09-25 alongside the light/dark/system theme rollout.

## 1. Stack constraints (read this first)

- Tailwind **v4**, CSS-first config (`@tailwindcss/vite` plugin, no `tailwind.config.js`).
  Tokens live in `src/index.css` under `:root` / `.dark` + `@theme inline`.
- Dark mode strategy: **class-based**, via `@custom-variant dark (&:where(.dark, .dark *));`
  in `src/index.css`. `.dark` class is toggled on `<html>` by `ThemeProvider`. This is
  the Tailwind v4 equivalent of `darkMode: 'class'` — v4 has no JS config file to set
  that option in, so the custom-variant line **is** the strategy declaration. Do not
  add a `tailwind.config.js` "to fix" this.

## 2. Design tokens

All colors are **semantic CSS variables**, never raw Tailwind palette classes
(no `bg-slate-100`, `text-indigo-600`, etc. in component code — grep for
`slate-\|indigo-\|red-[0-9]\|amber-\|emerald-\|purple-[0-9]\|green-[0-9]` should
return nothing under `src/`). Each token has a light value (`:root`) and dark
value (`.dark`), exposed to Tailwind via `@theme inline` so they're usable as
plain utilities: `bg-surface`, `text-fg-muted`, `border-border`, etc.

| Token | Usage |
|---|---|
| `surface` | App background (`body`, page bg) |
| `surface-raised` | Cards, header, table, modal, inputs |
| `surface-sunken` | Table head, code blocks, disabled input bg, subtle row hover |
| `surface-overlay` | Modal backdrop (translucent) |
| `fg` | Primary text |
| `fg-muted` | Secondary text (labels, body copy in muted contexts) |
| `fg-subtle` | Tertiary text (hints, placeholders-as-text, table head caps, empty states) |
| `fg-on-accent` | Text on solid accent-colored surfaces |
| `border` / `border-strong` | Default / emphasized borders |
| `accent` / `accent-hover` / `accent-fg` | Primary brand action (buttons, active nav, focus ring, links) |
| `danger` / `danger-fg` / `danger-surface` / `danger-border` | Errors, destructive actions |
| `warning` / `warning-fg` / `warning-surface` / `warning-border` | Warnings, "not published" states |
| `success` / `success-fg` / `success-surface` / `success-border` | Success confirmations |
| `info` / `info-fg` / `info-surface` / `info-border` | Informational badges (currently reuses accent hue) |
| `accent-experimental-*` | OpenAI Realtime tab + "system-only" config sections — visually flags **experimental/dev-only** surfaces (was hardcoded `purple-*` before) |

### Why a 3-tier text scale (`fg` / `fg-muted` / `fg-subtle`)

Matches the original app's implicit hierarchy (`slate-900` / `slate-700` /
`slate-500`+`slate-400`) but collapsed to 3 tiers and **contrast-audited** —
see §5. Do not reintroduce a 4th tier without re-auditing contrast.

### Adding a new token

1. Add to both `:root` and `.dark` in `src/index.css`.
2. Add a matching `--color-*` line in the `@theme inline` block so it becomes
   a Tailwind utility.
3. Contrast-check both light and dark values against every background they'll
   render on (see §5 method) before using in a component.

## 3. Theme system (light / dark / system)

- `src/theme/ThemeProvider.tsx` — context + logic. `useTheme()` hook exposes
  `{ mode, resolvedTheme, setMode }`. `mode` is what the user picked
  (`"light" | "dark" | "system"`); `resolvedTheme` is the actual applied theme
  (`"light" | "dark"`).
- Persistence: `localStorage` key `teleapo-ui-theme` (separate from the
  existing `teleapo-ui-lang` i18n key — do not conflate).
- `system` mode subscribes to `matchMedia("(prefers-color-scheme: dark)")`
  `change` events — flips live with no reload while `mode === "system"`.
  Switching away from `system` unsubscribes.
- **FOUC guard**: `index.html` has an inline pre-hydration `<script>` that
  reads the same localStorage key and adds `.dark` to `<html>` before first
  paint. If you ever change the storage key or resolution logic in
  `ThemeProvider.tsx`, update the inline script in `index.html` to match —
  they must stay in sync or you'll get a flash of wrong theme.
- UI: `src/theme/ThemeToggle.tsx`, a 3-way segmented control (☀ / ☾ / 💻),
  same visual pattern as the existing language switcher. Placed in
  `AppLayout.tsx` header, next to the language switcher, separated by a
  vertical divider.
- i18n: `theme.light` / `theme.dark` / `theme.system` / `theme.toggleLabel`
  keys added to all 3 locales (vi/en/ja) — reuse these, don't hardcode new
  theme-related strings.

### Adding theme awareness to a new component

Never branch on `resolvedTheme` in component logic to pick colors — that
defeats the point of tokens. Use token utility classes
(`bg-surface-raised`, `text-fg`, `border-border`, …) and let the CSS variables
handle it. Only read `resolvedTheme`/`mode` for non-style logic (e.g. picking
a different image asset, or a chart library needing raw color values).

## 4. Component patterns

Shared primitives in `src/components/ui/`: `TextInput`, `Textarea`, `Select`,
`Checkbox`. All support a `variant` prop (`"default" | "purple"`) — `purple`
now maps to `accent-experimental-*` tokens, used for the OpenAI Realtime tab
and system-only config blocks to visually flag them as distinct/experimental.
**Reuse these** instead of hand-rolling `<input>`/`<select>` styling; this was
already the pattern before this redesign (see file header comments), now
extended with `Select` (previously every dropdown hand-rolled the same
classes — DRY violation, fixed here).

- **Buttons**: primary action = `bg-accent text-accent-fg hover:bg-accent-hover`,
  optionally `shadow-sm` for page-level primary CTAs (e.g. "+ Tạo lead").
  Secondary/cancel = `border border-border text-fg-muted hover:bg-surface-sunken`.
  Destructive = `border-danger-border text-danger-fg hover:bg-danger-surface`
  (outline style, not solid — matches existing delete-button pattern).
- **Cards/panels**: `rounded-lg border border-border bg-surface-raised p-6`
  (or `p-4` for filter bars).
- **Tables**: wrapper `rounded-lg border border-border bg-surface-raised`;
  `<thead>` = `border-b border-border bg-surface-sunken text-xs uppercase
  tracking-wide text-fg-subtle`; rows = `border-b border-border last:border-0
  hover:bg-surface-sunken/60`.
- **Badges** (status pills): `inline-flex rounded-full px-2.5 py-0.5 text-xs
  font-medium` + one of the semantic surface/fg/border triads
  (`bg-success-surface text-success-fg border border-success-border`, etc).
  Unknown/fallback status = neutral (`bg-surface-sunken text-fg-muted
  border border-border`).
- **Banners** (inline alerts): `rounded-md border px-4 py-2 text-sm` +
  semantic triad, e.g. `border-danger-border bg-danger-surface text-danger-fg`.
- **Modals**: backdrop `bg-surface-overlay` (not a hardcoded black/slate
  opacity), panel `border border-border bg-surface-raised shadow-xl`.
- **Focus states**: `outline-none focus:ring-1 focus:ring-accent
  focus:border-accent` on all inputs — never remove focus rings.

## 5. Accessibility — contrast method (WCAG 2.1 AA)

Every text/background token pair used for **normal-size body text** was
verified ≥ 4.5:1 (not just the 3:1 large-text minimum) against the *worst-case*
background it can appear on in that theme (e.g. `fg-subtle` was checked against
`surface-sunken` in light mode and `surface-raised` in dark mode, not just the
main `surface`, because table heads/hints render on both). Method: standard
WCAG relative-luminance formula, `(L1+0.05)/(L2+0.05)`. If you change a token
value, re-run this check — a color that looks fine to the eye can still fail
AA (this caught two real regressions during this rollout: default
`slate-400`-equivalent for `fg-subtle` failed on light backgrounds at 2.45:1,
and the dark-mode accent button text was 4.47:1, just under the 4.5:1 line).

Other AA requirements already in place / to preserve:
- Touch targets ≥ 44×44px on interactive controls where feasible (buttons use
  `py-2`/`py-1.5` + padding, meets this in practice at default font sizes).
- `prefers-reduced-motion: reduce` is respected globally (see bottom of
  `index.css`) — don't add animations that ignore this media query.
- Never convey status via color alone — badges/banners already pair color
  with text (status name, error message), keep that pattern.

## 6. Typography & spacing

No new font was introduced (Vietnamese i18n content already renders fine with
the system font stack Tailwind defaults to — no diacritic issues observed).
Scale in use, keep consistent:

- Page title: `text-2xl font-semibold tracking-tight`
- Section/card title: `text-base font-semibold` (or `text-lg` for modal titles)
- Body / table cell: `text-sm`
- Hint / meta / badge: `text-xs`

Spacing: page sections stack with `flex flex-col gap-6`; card internals with
`gap-3`–`gap-4`; form fields `gap-1` (label→input) inside `gap-3` groups.

## 7. What NOT to do

- Don't hardcode Tailwind palette colors (`slate-*`, `indigo-*`, `red-*`, etc.)
  in any component — always go through a token.
- Don't branch component render logic on `resolvedTheme` for styling — use
  token classes.
- Don't add a `tailwind.config.js` — this project is Tailwind v4 CSS-first;
  config changes belong in `src/index.css`.
- Don't introduce a new "enhanced" component file alongside an existing one —
  edit the existing file (matches `.claude/workflows/development-rules.md`).
- Don't hardcode new user-facing strings — every string must go through
  `react-i18next` with keys added to all 3 locale files (vi/en/ja).
