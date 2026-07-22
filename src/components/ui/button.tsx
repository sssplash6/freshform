import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/** Brand (blue) = actions (DESIGN.md). No accent-colored buttons — orange is
 * reserved for hours/progress. Red only for destructive. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-brand/80 text-brand hover:bg-brand hover:text-white",
  ghost: "text-brand hover:bg-brand-soft",
  danger: "border border-red-300 text-red-700 hover:bg-red-50",
};

/** Fixed, proportionate heights — sm for inline/table actions, md for the
 * primary actions on a view. Height is set here, not forced globally, so a
 * small label never sits in an oversized box. */
const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A link that looks like a button (navigation that should read as an action). */
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: LinkButtonProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
