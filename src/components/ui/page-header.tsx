import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { ProgramTone } from "@/lib/person-tone";

export type BannerTone = "brand" | "log" | "plan" | "warm";

const WASH: Record<BannerTone, string> = {
  brand: "from-brand-soft to-surface",
  log: "from-log-soft to-surface",
  plan: "from-plan-soft to-surface",
  warm: "from-accent-soft to-surface",
};

const RULE: Record<BannerTone, string> = {
  brand: "bg-brand/70",
  log: "bg-log-ink/70",
  plan: "bg-plan-ink/70",
  warm: "bg-accent",
};

const EYEBROW: Record<BannerTone, string> = {
  brand: "text-brand",
  log: "text-log-ink",
  plan: "text-plan-ink",
  warm: "text-accent-ink",
};

/**
 * The page's banner: an optional back-link above it, then a tinted card holding
 * a small-caps eyebrow, the h1, a subtitle line and an actions cluster. A
 * `monogram` sets the oversized ghost letters watermarked into the corner,
 * which give each student's page an identity you recognise before reading.
 *
 * Every prop but `title` is optional, so a plain page stays plain.
 */
export function PageHeader({
  backHref,
  backLabel,
  eyebrow,
  title,
  subtitle,
  actions,
  leading,
  monogram,
  tone = "brand",
  programTone,
  className,
}: {
  backHref?: string;
  backLabel?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Rendered left of the title block — a profile picture, typically. */
  leading?: React.ReactNode;
  monogram?: string;
  tone?: BannerTone;
  /**
   * A program's own hue (lib/person-tone.ts), which wins over `tone`. Programs
   * each get their own so their pages don't read as three identical headers.
   */
  programTone?: ProgramTone;
  className?: string;
}) {
  const wash = programTone?.wash ?? WASH[tone];
  const rule = programTone?.rule ?? RULE[tone];
  const eyebrowColor = programTone?.eyebrow ?? EYEBROW[tone];

  return (
    <div className={cn("space-y-2.5", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-fg hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {backLabel}
        </Link>
      )}

      <div className="lift-in relative overflow-hidden rounded-2xl border border-line bg-surface">
        <div className={cn("h-[3px] w-full", rule)} aria-hidden="true" />
        <div
          className={cn("bg-gradient-to-br px-5 py-5 sm:px-6 sm:py-6", wash)}
        >
          {monogram && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-7 right-3 select-none text-[104px] font-black leading-none tracking-tighter text-ink/[0.055]"
            >
              {monogram}
            </span>
          )}
          <div className="relative flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
            {/* `leading` sits left of the title block — a profile picture, so a
                person's page opens with their face instead of repeating their
                name in a card underneath. */}
            {leading && <div className="shrink-0">{leading}</div>}
            <div className="min-w-0 flex-1">
              {eyebrow && (
                <div
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.11em]",
                    eyebrowColor,
                  )}
                >
                  {eyebrow}
                </div>
              )}
              <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink sm:text-[32px]">
                {title}
              </h1>
              {subtitle && (
                <div className="mt-2 text-[15px] text-muted-fg">{subtitle}</div>
              )}
            </div>
            {actions && (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
