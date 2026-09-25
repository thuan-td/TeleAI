import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
}

/** Shared checkbox + label pair. See TextInput.tsx for why this was extracted. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className = "", ...props },
  ref,
) {
  return (
    <label className="flex w-fit items-center gap-2 text-sm text-fg-muted">
      <input
        ref={ref}
        type="checkbox"
        className={`h-4 w-4 rounded border-border-strong text-accent focus:ring-accent ${className}`}
        {...props}
      />
      {label}
    </label>
  );
});
