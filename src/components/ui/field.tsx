import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** The one text-field look, shared by Input, Textarea and the native Select. */
export const inputClasses =
  "min-h-11 w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition-colors placeholder:text-muted-fg hover:border-brand/40 focus:border-brand focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClasses, "resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

/**
 * Label-above field wrapper (DESIGN.md: label above input, inline result
 * below). Wraps its control in a <label> so the association is automatic;
 * hint and error render underneath.
 */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-accent-ink"> *</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="block text-xs text-muted-fg">{hint}</span>
      )}
      {error && (
        <span role="alert" className="block text-xs text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}
