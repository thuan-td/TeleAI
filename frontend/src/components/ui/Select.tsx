import { forwardRef, type SelectHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  default:
    "border-border bg-surface-raised text-fg focus:border-accent focus:ring-accent disabled:bg-surface-sunken disabled:text-fg-subtle",
  purple:
    "border-accent-experimental-border bg-surface-raised text-accent-experimental-fg focus:border-accent-experimental focus:ring-accent-experimental",
} as const;

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/** Shared styled <select>. Every dropdown in the app (status/lang filters,
 * model/voice/language pickers) was hand-rolling this same box style —
 * extracted alongside TextInput/Textarea/Checkbox so the token-based
 * light/dark styling lives in one place (DRY). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { variant = "default", className = "", children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});
