import { forwardRef, type TextareaHTMLAttributes } from "react";

const VARIANT_CLASSES = {
  default: "border-slate-300 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100",
  purple: "border-purple-300 bg-white text-purple-900 focus:border-purple-500 focus:ring-purple-500",
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
      className={`rounded-md border px-3 py-2 text-sm outline-none focus:ring-1 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
});
