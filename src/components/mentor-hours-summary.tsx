import { StatCard, StatCardGrid } from "@/components/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format";
import { personBanner } from "@/lib/person-tone";
import type { MentorOverview } from "@/lib/queries";

/**
 * A mentor's hours: the cumulative position first, then the same figures split
 * by program.
 *
 * ONE hue does all the work. Allocated hours decompose into delivered, missed,
 * remaining and expired — four states, which is exactly the point at which it
 * gets tempting to invent four colours for them. That would bury the number
 * anyone actually opens this page for. So the bar is a single orange fill
 * (hours, per DESIGN.md) against a neutral track, and the states are named in
 * text beside it. Red enters only for an overdrawn balance.
 *
 * Panel tone is `total`: these are derived figures, editable by nobody.
 *
 * NOT shown to students — a mentor's totals span every student they teach.
 */
export function MentorHoursSummary({
  totals,
  byProgram,
  /** First person, for the mentor reading their own page. */
  possessive,
}: Pick<MentorOverview, "totals" | "byProgram"> & { possessive: string }) {
  const overdrawn = totals.remaining < 0;

  return (
    <Panel tone="total">
      <PanelHeader
        tone="total"
        eyebrow="Derived"
        title="Hours"
        caption="Every program, all time"
      />

      <div className="px-4 sm:px-5">
        <StatCardGrid>
          {/* The figure this panel exists to answer. */}
          <StatCard
            lead
            label="Allocated"
            value={formatHours(totals.allocated)}
            suffix="h"
          />
          <StatCard
            label="Delivered"
            value={formatHours(totals.delivered)}
            suffix="h"
            tone="brand"
          />
          <StatCard
            label={overdrawn ? "Overdrawn" : "Still to deliver"}
            value={formatHours(Math.abs(totals.remaining))}
            suffix="h"
            tone={overdrawn ? "danger" : "default"}
          />
          <StatCard
            label={totals.students === 1 ? "Student" : "Students"}
            value={String(totals.students)}
          />
          {/* Only worth a slot when there is something in it. */}
          {totals.missed > 0 && (
            <StatCard
              label="Missed"
              value={formatHours(totals.missed)}
              suffix="h"
              tone="muted"
            />
          )}
          {totals.forfeited > 0 && (
            <StatCard
              label="Expired"
              value={formatHours(totals.forfeited)}
              suffix="h"
              tone="muted"
            />
          )}
        </StatCardGrid>
      </div>

      {byProgram.length === 0 ? (
        <EmptyState framed={false} title="No hours yet">
          {possessive} hours appear here once an admin allocates them to a
          student.
        </EmptyState>
      ) : (
        <ul>
          {byProgram.map((row, i) => {
            const used = row.used;
            const pct = row.allocated > 0 ? (used / row.allocated) * 100 : 0;
            const rowOverdrawn = row.remaining < 0;
            return (
              <li
                key={row.id}
                className="deal-in border-t border-line px-4 py-4 sm:px-5"
                style={{ animationDelay: `${Math.min(i, 8) * 24}ms` }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {/* The program's own hue, the same one its pages open in. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        personBanner(row.id).rule
                      )}
                    />
                    <span className="truncate text-sm font-semibold text-ink">
                      {row.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-fg">
                      {row.students} {row.students === 1 ? "student" : "students"}
                    </span>
                  </div>
                  <div className="tabular-nums">
                    <span className="text-lg font-bold tracking-tight text-ink">
                      {formatHours(row.allocated)}
                    </span>
                    <span className="ml-1 text-xs text-muted-fg">h allocated</span>
                  </div>
                </div>

                <Meter
                  className="mt-2.5"
                  pct={pct}
                  tone={rowOverdrawn ? "danger" : "accent"}
                  ariaValueNow={used}
                  ariaValueMax={row.allocated}
                  ariaLabel={`Hours used in ${row.name}`}
                />

                <p className="mt-2 text-xs tabular-nums text-muted-fg">
                  <span className="font-medium text-accent-ink">
                    {formatHours(row.delivered)}h delivered
                  </span>
                  {/* "0h still to deliver" is noise on an expired allocation —
                      there is nothing left to deliver BECAUSE it expired, and
                      the expired figure says so. */}
                  {(row.remaining !== 0 || row.forfeited === 0) && (
                    <>
                      {" · "}
                      <span
                        className={rowOverdrawn ? "font-medium text-red-700" : ""}
                      >
                        {formatHours(Math.abs(row.remaining))}h{" "}
                        {rowOverdrawn ? "overdrawn" : "still to deliver"}
                      </span>
                    </>
                  )}
                  {row.missed > 0 && ` · ${formatHours(row.missed)}h missed`}
                  {row.forfeited > 0 && ` · ${formatHours(row.forfeited)}h expired`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
