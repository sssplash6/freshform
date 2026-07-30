import { Chip } from "@/components/chip";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { personTone } from "@/lib/person-tone";
import { cn } from "@/lib/cn";
import type { LedgerSession } from "@/lib/queries";

/**
 * The student's sessions as a timeline rather than the admin's table. Same rows,
 * different question: staff audit a ledger, a student is looking back over work
 * they did with people they know. So the mentor leads each entry, the date is a
 * marker down a rail, and the hours are a quiet aside instead of a column.
 *
 * The rail dot takes the mentor's identity color, which makes a run of sessions
 * with the same person visible as a run.
 */
export function StudentJourney({ sessions }: { sessions: LedgerSession[] }) {
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const total = active.reduce((sum, s) => sum + s.hours, 0);

  return (
    <Panel tone="log">
      <PanelHeader
        tone="log"
        eyebrow="Logged by your mentors"
        title="Sessions so far"
        caption={
          active.length === 0
            ? undefined
            : `${active.length} session${active.length === 1 ? "" : "s"} · ${formatHours(total)} hours`
        }
      />

      {sessions.length === 0 ? (
        <EmptyState framed={false} title="No sessions yet">
          Book your first session and it appears here once your mentor logs it,
          with what you covered together.
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
                        voided
                          ? "text-muted-fg line-through"
                          : "font-semibold text-accent-ink",
                      )}
                    >
                      {formatHours(s.hours)}h
                    </span>
                  </div>

                  {s.assignment && (
                    <p className="mt-1.5 text-[13px] font-medium text-plan-ink">
                      {s.assignment.purpose}
                    </p>
                  )}
                  {s.task && (
                    <p className="mt-1 text-[15px] text-ink">{s.task}</p>
                  )}
                  {s.note && (
                    <p className="mt-0.5 text-sm text-muted-fg">{s.note}</p>
                  )}

                  {(voided || !s.attended) && (
                    <div className="mt-2">
                      {voided ? (
                        <Chip tone="gray">Cancelled, hours returned</Chip>
                      ) : (
                        <Chip tone="amber">Missed, hours still charged</Chip>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
