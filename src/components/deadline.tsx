import { deadlinePassed } from "@/lib/deadlines";
import { formatDate } from "@/lib/format";

/**
 * An allocation's use-by deadline. Deadlines are required, and once one passes
 * the allocation's unused hours are forfeited — so a passed deadline always
 * renders red as "expired".
 */
export function Deadline({ deadline }: { deadline: Date | null }) {
  if (!deadline) return <span className="text-muted-fg">—</span>;
  if (deadlinePassed(deadline)) {
    return (
      <span className="font-medium text-red-700">
        {formatDate(deadline)} · expired
      </span>
    );
  }
  return <span>{formatDate(deadline)}</span>;
}
