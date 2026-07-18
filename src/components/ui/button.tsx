import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/** Navy = actions (DESIGN.md). No brand-colored buttons — orange is reserved
 * for hours/progress. Red only for destructive. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-navy text-white hover:bg-navy/90",
  secondary: "border border-navy/80 text-navy hover:bg-navy hover:text-white",
  ghost: "text-navy hover:bg-mist/60",
  danger: "border border-red-300 text-red-700 hover:bg-red-50",
};

/** Every button clears the 44px touch target (globals.css enforces it too);
 * sizes differ only in padding + label size. */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 gap-1.5 px-3 text-[13px]",
  md: "min-h-11 gap-2 px-4 text-sm",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
