import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Page title block: optional back-link, the h1, an optional subtitle line, and
 * an optional actions cluster on the right. Replaces the hand-rolled title +
 * back-link markup repeated across the detail pages.
 */
export function PageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  actions,
  className,
}: {
  backHref?: string;
  backLabel?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-fg hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1.5 text-[15px] text-muted-fg">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
