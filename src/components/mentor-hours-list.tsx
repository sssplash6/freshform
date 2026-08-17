import { Deadline } from "@/components/deadline";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";

type MentorHours = {
  /** Null = hours granted before a consultant was chosen. */
  mentor: { id: string; name: string | null; email: string } | null;
  allocated: number;
  completed: number;
  missed: number;
  remaining: number;
  forfeited: number;
  expired: boolean;
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
  // The student's team is the people on it; pooled hours awaiting a mentor
  // show as their own row but aren't a mentor to count.
  const mentorCount = items.filter((m) => m.mentor).length;
  return (
    <Panel tone="total">
      <PanelHeader
        tone="total"
        eyebrow="Your team"
        title="Hours with each mentor"
        caption={
          mentorCount === 0
            ? undefined
            : `${mentorCount} mentor${mentorCount === 1 ? "" : "s"} working with you`
        }
      />
      {items.length === 0 ? (
        <EmptyState framed={false} title="No mentor hours yet">
          An admin will allocate your mentoring hours soon. They&apos;ll appear
          here.
        </EmptyState>
      ) : (
      <ul className="divide-y divide-line/60">
        {items.map((m) => {
          const overdrawn = m.remaining < 0;
          const used = m.completed + m.missed;
          // "Gone" = hours consumed plus any forfeited past the deadline.
          const gone = used + m.forfeited;
          const pct =
            m.allocated > 0
              ? Math.min(100, Math.round((gone / m.allocated) * 100))
              : 0;
          return (
            <li key={m.mentor?.id ?? "unassigned"} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {m.mentor ? (
                  <PersonChip person={m.mentor} size="sm" />
                ) : (
                  <span className="text-sm font-medium text-muted-fg">
                    Mentor to be confirmed
                  </span>
                )}
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
                tone={overdrawn || m.expired ? "danger" : "accent"}
                ariaValueNow={used}
                ariaValueMax={m.allocated}
                ariaLabel={`Hours used with ${m.mentor ? (m.mentor.name ?? m.mentor.email) : "your unassigned pool"}`}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-fg">
                <span className="tabular-nums">
                  {formatHours(used)} of {formatHours(m.allocated)} hours used
                  {m.missed > 0 ? ` · ${formatHours(m.missed)} missed` : ""}
                  {m.forfeited > 0 ? (
                    <span className="text-red-700">
                      {" "}
                      · {formatHours(m.forfeited)} expired unused
                    </span>
                  ) : (
                    ""
                  )}
                </span>
                <Deadline deadline={m.deadline} />
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </Panel>
  );
}
