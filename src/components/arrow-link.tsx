import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";

/** Brand-blue text link whose arrow slides right on hover. Use for "go
 * somewhere" affordances instead of a literal "→" glyph. */
export function ArrowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand hover:text-brand-dark ${className}`}
    >
      {children}
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
