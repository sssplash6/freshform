import { formatDate } from "@/lib/format";

/**
 * An allocation's use-by deadline: plain date while it's ahead, red "passed"
 * once it's behind and hours are still unused (deadlines flag, never block).
 */
export function Deadline({
  deadline,
  remaining,
}: {
  deadline: Date | null;
  remaining: number;
}) {
  if (!deadline) return <span className="text-gray-400">—</span>;
  const passed = deadline.getTime() < Date.now();
  if (passed && remaining > 0) {
    return (
      <span className="font-medium text-red-700">
        {formatDate(deadline)} — passed
      </span>
    );
  }
  return <span className={passed ? "text-gray-400" : ""}>{formatDate(deadline)}</span>;
}
