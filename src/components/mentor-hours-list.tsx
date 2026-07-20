import { Deadline } from "@/components/deadline";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

type MentorHours = {
  mentor: { id: string; name: string | null; email: string };
  allocated: number;
  completed: number;
  remaining: number;
  deadline: Date | null;
};

/**
 * The student's hours with each mentor, as a calm ledger meter: the remaining
 * balance leads, a thin orange bar shows how much of the allotment has been
 * used (orange = hours/progress per DESIGN.md), and the exact "used / total"
 * plus any use-by date sit underneath. Approachable for external students
 * without turning hours into a game.
 */
export function MentorHoursList({ items }: { items: MentorHours[] }) {
  if (items.length === 0) {
    return (
      <EmptyState title="No mentor hours yet">
        An admin will allocate your mentoring hours soon. They&apos;ll appear
        here.
      </EmptyState>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-line/60">
        {items.map((m) => {
          const overdrawn = m.remaining < 0;
          const pct =
            m.allocated > 0
              ? Math.min(100, Math.round((m.completed / m.allocated) * 100))
              : 0;
          return (
            <li key={m.mentor.id} className="px-4 py-4 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium text-ink">
                  {m.mentor.name ?? m.mentor.email}
                </span>
                <span className="whitespace-nowrap text-sm text-muted-fg">
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      overdrawn ? "text-red-700" : "text-ink",
                    )}
                  >
                    {formatHours(overdrawn ? -m.remaining : m.remaining)}
                  </span>{" "}
                  {overdrawn ? "h over" : "h left"}
                </span>
              </div>
              <Meter
                className="mt-2.5"
                pct={overdrawn ? 100 : pct}
                tone={overdrawn ? "danger" : "accent"}
                ariaValueNow={m.completed}
                ariaValueMax={m.allocated}
                ariaLabel={`Hours used with ${m.mentor.name ?? m.mentor.email}`}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-fg">
                <span className="tabular-nums">
                  {formatHours(m.completed)} of {formatHours(m.allocated)} hours
                  used
                </span>
                <Deadline deadline={m.deadline} remaining={m.remaining} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
