import { cn } from "@/lib/cn";

/**
 * A composed empty state — an optional quiet icon, a plain-language line, and
 * an optional next-step action. Warmer than a bare "Nothing yet." string
 * (PRODUCT.md: encouraging tone), while staying inside the mist/white palette.
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  framed = true,
  className,
}: {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  framed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 px-6 py-10 text-center",
        framed && "rounded-lg border border-mist bg-white",
        className,
      )}
    >
      {icon && <div className="mb-1 text-mist [&_svg]:h-8 [&_svg]:w-8">{icon}</div>}
      {title && <p className="text-[15px] font-medium text-gray-700">{title}</p>}
      {children && (
        <div className="max-w-sm text-sm text-gray-500">{children}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
