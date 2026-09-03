import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import {
  ATTENDANCE,
  attendanceOf,
  chargesAllocation,
  SESSION_STATUS,
} from "@/lib/constants";
import { formatDate, formatDuration, formatMinutes } from "@/lib/format";
import { personTone } from "@/lib/person-tone";
import { cn } from "@/lib/cn";
import type { LedgerSession } from "@/lib/queries";
import { StatusChip } from "@/components/ui/status-chip";
import { ExpandableText } from "@/components/expandable-text";

/**
 * The meetings that already happened, as a timeline rather than the admin's
 * table. Same rows, different question: staff audit a ledger, a student is
 * looking back over work they did with people they know. So the mentor leads
 * each entry, the date is a marker down a rail, and the hours are a quiet aside
 * instead of a column.
 *
 * The rail dot takes the mentor's identity color, which makes a run of sessions
 * with the same person visible as a run.
 *
 * Deliberately shaped nothing like the upcoming list above it (a column of
 * calendar leaves): "done" and "still to come" are the two halves a student
 * scans this page for, and they should never have to read a heading to tell
 * which half they are looking at.
 */
export function StudentJourney({ sessions }: { sessions: LedgerSession[] }) {
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const total = active.filter(chargesAllocation).reduce((sum, s) => sum + s.minutes, 0);
  const extra = active
    .filter((s) => !s.withinPlan)
    .reduce((sum, s) => sum + s.minutes, 0);

  return (
    <Section
        eyebrow="Logged by your mentors"
        title="Meetings you've had"
        caption={
          active.length === 0
            ? undefined
            : `${active.length} meeting${active.length === 1 ? "" : "s"} · ${formatDuration(total)}${
                extra > 0 ? ` · ${formatDuration(extra)} extra` : ""
              }`
        }
      >

      {sessions.length === 0 ? (
        <EmptyState framed={false} title="No meetings yet">
          No meetings logged yet. Your mentors add them after each
              session.
        </EmptyState>
      ) : (
        <ol className="px-4 py-5 sm:px-6">
          {sessions.map((s, i) => {
            const voided = s.status === SESSION_STATUS.VOIDED;
            const tone = personTone(s.mentor.id);
            const last = i === sessions.length - 1;
            return (
              <li
                key={s.id}
                className="deal-in relative flex gap-4 pb-5 last:pb-0"
                style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
              >
                {/* The rail: a dot per session, joined by a hairline that stops
                    at the last entry so the line never dangles. */}
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-surface",
                      voided ? "bg-line" : tone.badge,
                    )}
                  />
                  {!last && (
                    <span
                      aria-hidden="true"
                      className="mt-1 w-px flex-1 bg-line"
                    />
                  )}
                </div>

                <div className={cn("min-w-0 flex-1", voided && "opacity-55")}>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <PersonChip person={s.mentor} size="sm" />
                    <span className="text-xs tabular-nums text-muted-fg">
                      {formatDate(s.date)}
                    </span>
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        voided || !chargesAllocation(s)
                          ? "text-muted-fg line-through"
                          : "font-semibold text-accent-ink",
                      )}
                    >
                      {formatMinutes(s.minutes)}
                    </span>
                  </div>

                  {s.assignment && (
                    <p className="mt-1.5 text-[13px] font-medium text-ink">
                      {s.assignment.purpose}
                    </p>
                  )}
                  {s.note && (
                    <div className="mt-1 text-[15px]">
                      <ExpandableText text={s.note} />
                    </div>
                  )}

                  {(voided ||
                    attendanceOf(s) !== ATTENDANCE.ATTENDED ||
                    !s.withinPlan) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {voided ? (
                        <StatusChip severity="neutral">Cancelled, time returned</StatusChip>
                      ) : (
                        <>
                          {attendanceOf(s) === ATTENDANCE.RESCHEDULED ? (
                            <StatusChip severity="neutral">Rescheduled, no time charged</StatusChip>
                          ) : attendanceOf(s) === ATTENDANCE.LATE ? (
                            <StatusChip severity="neutral">Started late</StatusChip>
                          ) : attendanceOf(s) === ATTENDANCE.ABSENT ? (
                            <StatusChip severity="attention">Missed, time charged</StatusChip>
                          ) : null}
                          {!s.withinPlan && (
                            <StatusChip severity="neutral">Extra, no time charged</StatusChip>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
