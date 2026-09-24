import { forwardRef, type InputHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  default: "border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100",
  purple: "border-purple-300 bg-white text-purple-900 focus:border-purple-500 focus:ring-purple-500",
} as const;

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/** Shared styled text-like <input> (type="text" by default, override via the
 * `type` prop for "date"/"search"/etc — same box styling either way).
 * `variant="purple"` matches the OpenAI Realtime tab's distinct theme;
 * `default` matches every other form (Retell tab, Knowledge Base, Call/Lead
 * filters, etc). Extracted 2026-09-24 to stop each form hand-rolling the same
 * Tailwind classes (DRY). */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { variant = "default", type = "text", className = "", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
