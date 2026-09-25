import { forwardRef, type TextareaHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  default:
    "border-border bg-surface-raised text-fg placeholder:text-fg-subtle focus:border-accent focus:ring-accent disabled:bg-surface-sunken disabled:text-fg-subtle",
  purple:
    "border-accent-experimental-border bg-surface-raised text-accent-experimental-fg placeholder:text-fg-subtle focus:border-accent-experimental focus:ring-accent-experimental",
} as const;

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/** Shared styled <textarea>. See TextInput.tsx for why this was extracted. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = "default", className = "", ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
