import Link from "next/link";

import { ArrowRightIcon } from "@/components/icons";

/** Navy text link whose arrow slides right on hover. Use for "go somewhere"
 * affordances instead of a literal "→" glyph. */
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
      className={`group inline-flex items-center gap-1.5 font-semibold text-navy hover:text-brand-deep ${className}`}
    >
      {children}
      <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
