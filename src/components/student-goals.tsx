import { CheckIcon } from "@/components/icons";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { ASSIGNMENT_PROGRESS } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { LedgerAssignment } from "@/lib/queries";

/**
 * The student's plan, in their language. The admin sees the same rows as a
 * spreadsheet with an hour budget and a consultant column; a student wants to
 * know what is being worked on for them, by whom, and how far along it is.
 *
 * So: cards grouped by state rather than a table sorted by position, each with a
 * bar that fills as hours are logged. Active work leads, finished work collapses
 * to a quiet checked line at the bottom, because a plan reads forward.
 */
function GoalCard({
  goal,
  index,
}: {
  goal: LedgerAssignment;
  index: number;
}) {
  const limit = goal.hourLimit ?? 0;
  const pct = limit > 0 ? Math.min(100, Math.round((goal.loggedHours / limit) * 100)) : 0;
  const over = limit > 0 && goal.loggedHours > limit;

  return (
    <li
      className="deal-in rounded-xl border border-line bg-surface p-4 transition-shadow hover:shadow-soft"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <h3 className="text-[15px] font-semibold leading-snug text-ink">
          {goal.purpose}
        </h3>
        {goal.deadline && (
          <span className="shrink-0 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-muted-fg">
            {goal.deadline}
          </span>
        )}
      </div>

      <div className="mt-3">
        <PersonChip person={goal.mentor} size="sm" />
      </div>

      {limit > 0 ? (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className={cn(
                "bar-grow h-full rounded-full",
                over ? "bg-amber-500" : "bg-accent",
              )}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-fg">
            <span className="font-semibold tabular-nums text-ink">
              {formatHours(goal.loggedHours)}
            </span>{" "}
            of {formatHours(limit)} hours so far
          </p>
        </>
      ) : (
        <p className="mt-3 text-xs text-muted-fg">
          {goal.loggedHours > 0
            ? `${formatHours(goal.loggedHours)} hours so far`
            : "Not started yet"}
        </p>
      )}
    </li>
  );
}

export function StudentGoals({
  assignments,
}: {
  assignments: LedgerAssignment[];
}) {
  const done = assignments.filter(
    (a) => a.progress === ASSIGNMENT_PROGRESS.DONE,
  );
  const active = assignments.filter(
    (a) => a.progress === ASSIGNMENT_PROGRESS.IN_PROGRESS,
  );
  const upcoming = assignments.filter(
    (a) => a.progress === ASSIGNMENT_PROGRESS.NOT_STARTED,
  );

  return (
    <Panel tone="plan">
      <PanelHeader
        tone="plan"
        eyebrow="Planned with your team"
        title="What we're working on"
        caption={
          assignments.length === 0
            ? undefined
            : `${done.length} of ${assignments.length} finished`
        }
      />

      {assignments.length === 0 ? (
        <EmptyState framed={false} title="Nothing planned yet">
          Your team sets out the work they&apos;ll do with you here — essays,
          recommendation letters, reviews — each with the hours it should take.
        </EmptyState>
      ) : (
        <div className="space-y-5 px-4 py-4 sm:px-5">
          {active.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-plan-ink">
                In progress now
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {active.map((g, i) => (
                  <GoalCard key={g.id} goal={g} index={i} />
                ))}
              </ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-fg">
                Coming up
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {upcoming.map((g, i) => (
                  <GoalCard key={g.id} goal={g} index={active.length + i} />
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-green-700">
                Finished
              </h2>
              {/* Collapsed to one line each: done work is reassuring to see but
                  shouldn't compete with what's still live. */}
              <ul className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line bg-surface">
                {done.map((g, i) => (
                  <li
                    key={g.id}
                    className="deal-in flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"
                    >
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {g.purpose}
                    </span>
                    <PersonChip person={g.mentor} size="sm" />
                    <span className="text-xs tabular-nums text-muted-fg">
                      {formatHours(g.loggedHours)}h
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
}
