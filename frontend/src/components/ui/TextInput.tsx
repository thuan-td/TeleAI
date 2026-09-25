import { forwardRef, type InputHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  default:
    "border-border bg-surface-raised text-fg placeholder:text-fg-subtle focus:border-accent focus:ring-accent disabled:bg-surface-sunken disabled:text-fg-subtle",
  purple:
    "border-accent-experimental-border bg-surface-raised text-accent-experimental-fg placeholder:text-fg-subtle focus:border-accent-experimental focus:ring-accent-experimental",
} as const;

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/** Shared styled text-like <input> (type="text" by default, override via the
 * `type` prop for "date"/"search"/etc — same box styling either way).
 * `variant="purple"` matches the OpenAI Realtime tab's distinct theme;
 * `default` matches every other form (Retell tab, Knowledge Base, Call/Lead
 * filters, etc). Extracted 2026-09-24 to stop each form hand-rolling the same
 * Tailwind classes (DRY). Colors are semantic tokens (see index.css /
 * docs/design-guidelines.md) so light/dark both resolve correctly. */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { variant = "default", type = "text", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
