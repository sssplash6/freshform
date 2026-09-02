import Link from "next/link";

import { Chip } from "@/components/chip";
import { ExpandableText } from "@/components/expandable-text";
import { PersonChip } from "@/components/person-chip";
import { SessionRowActions } from "@/components/forms/session-row-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ATTENDANCE,
  ATTENDANCE_META,
  attendanceOf,
  chargesAllocation,
  TIME_KIND_META,
  timeKindOf,
  SESSION_STATUS,
} from "@/lib/constants";
import { formatDate, formatDuration, formatMinutes, toDateInputValue } from "@/lib/format";

/**
 * Structural, not Prisma-derived: the same table serves one student's ledger
 * and the cross-student log on a dashboard, which are different queries.
 */
export type LoggedMeeting = {
  id: string;
  minutes: number;
  date: Date;
  attended: boolean;
  late: boolean;
  note: string | null;
  status: string;
  /** False = logged out of plan: delivered, but charged to no allocation. */
  withinPlan: boolean;
  mentor: { id: string; name: string | null; email: string };
  /** Present only on cross-student logs, where a Student column is needed. */
  student?: { id: string; user: { name: string | null; email: string } } | null;
  /** The task this meeting went toward; null when none was named. */
  assignment?: { id: string; purpose: string } | null;
};

/**
 * Who is reading, and therefore which rows they may change. A mentor may correct
 * and void their own; an admin may do both to anyone's, and is the only one who
 * can delete a row outright.
 */
export type ManageMeetings = {
  actorId?: string;
  isAdmin?: boolean;
  /**
   * sessionId → the tasks THAT row could be attached to (its own mentor's, for
   * its own student). Keyed per session because a log can span both — see
   * queries.ts#taskOptionsForSessions.
   */
  tasksBySession?: Record<string, { value: string; label: string }[]>;
};

/**
 * The left half of the tracking spreadsheet: meetings mentors logged, in the
 * sheet's own column order (who, how long, when, what was covered). Mentors own
 * this data by logging sessions, which is what the amber panel tone says.
 *
 * Voided sessions stay listed but greyed with a struck-through duration: they
 * are part of the history even though their time went back.
 */
export function MeetingsLog({
  sessions,
  title = "Meetings log",
  eyebrow = "Logged by mentors",
  emptyBody = "Every session a mentor logs shows up here, newest first.",
  caption,
  mentorBase,
  manage,
  moreHref,
  moreLabel = "All sessions",
}: {
  sessions: LoggedMeeting[];
  title?: string;
  eyebrow?: React.ReactNode;
  emptyBody?: React.ReactNode;
  /**
   * Overrides the header's tally. Pass it when these rows are a slice of a
   * wider set, so the caption describes the whole thing rather than the slice.
   */
  caption?: React.ReactNode;
  /** Base path (admin only) that makes each Team chip link to its mentor. */
  mentorBase?: string;
  /** Present when the reader may correct rows in this log. */
  manage?: ManageMeetings;
  /** Shown in the header when the log is a truncated slice of a longer one. */
  moreHref?: string;
  moreLabel?: string;
}) {
  // The tally counts what was actually charged: rescheduled and voided rows are
  // part of the history, not of the hours — and neither are out-of-plan hours,
  // which are called out beside the total rather than folded into it.
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const loggedMinutes = active
    .filter(chargesAllocation)
    .reduce((sum, s) => sum + s.minutes, 0);
  const extraMinutes = active
    .filter((s) => !s.withinPlan)
    .reduce((sum, s) => sum + s.minutes, 0);
  const withStudent = sessions.some((s) => s.student);
  // On a mentor's own log every row is them, so the Team column would just
  // repeat one name down the page. Drop it unless the log spans people.
  const withTeam = new Set(sessions.map((s) => s.mentor.id)).size > 1;

  // Correcting is for rows that still count and belong to the reader (any row,
  // if they're an admin). Deleting is an admin's alone, and applies to a voided
  // row too: those hours are already back, but the line is still in the log, and
  // a line that should never have been there should be removable.
  const canEdit = (s: LoggedMeeting) =>
    Boolean(manage) &&
    s.status !== SESSION_STATUS.VOIDED &&
    (manage?.isAdmin === true || s.mentor.id === manage?.actorId);
  const canDelete = () => manage?.isAdmin === true;
  const hasActions = (s: LoggedMeeting) => canEdit(s) || canDelete();
  const withActions = sessions.some(hasActions);

  const columns: Column[] = [
    ...(withTeam ? [{ label: "Team" } as Column] : []),
    ...(withStudent ? [{ label: "Student" } as Column] : []),
    { label: "Duration", align: "right" },
    { label: "Date" },
    { label: "Task" },
    { label: "Notes" },
    ...(withActions ? [{ label: "", align: "right" } as Column] : []),
  ];

  const tally =
    caption ??
    (active.length === 0
      ? "Nothing logged yet"
      : `${active.length} meeting${active.length === 1 ? "" : "s"} · ${formatDuration(loggedMinutes)}${
          extraMinutes > 0 ? ` · ${formatDuration(extraMinutes)} extra` : ""
        }`);

  return (
    <Panel tone="log">
      <PanelHeader
        tone="log"
        eyebrow={eyebrow}
        title={title}
        action={
          moreHref ? (
            <span className="flex items-center gap-3 text-xs text-muted-fg">
              {tally}
              <Link
                href={moreHref}
                className="font-medium text-brand hover:underline"
              >
                {moreLabel} →
              </Link>
            </span>
          ) : undefined
        }
        caption={tally}
      />

      {sessions.length === 0 ? (
        <EmptyState framed={false} title="No meetings logged yet">
          {emptyBody}
        </EmptyState>
      ) : (
        <Table framed={false} columns={columns}>
          {sessions.map((s, i) => {
            const voided = s.status === SESSION_STATUS.VOIDED;
            const state = attendanceOf(s);
            return (
              <Tr
                key={s.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                {withTeam && (
                  <Td label="Team" className={voided ? "opacity-45" : undefined}>
                    <PersonChip
                      person={s.mentor}
                      size="sm"
                      href={mentorBase && `${mentorBase}/${s.mentor.id}`}
                    />
                  </Td>
                )}
                {withStudent && (
                  <Td label="Student" className={voided ? "opacity-55" : undefined}>
                    {s.student ? (
                      <Link
                        href={`/admin/students/${s.student.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {s.student.user.name ?? s.student.user.email}
                      </Link>
                    ) : (
                      <span className="text-muted-fg">—</span>
                    )}
                  </Td>
                )}
                <Td label="Duration" align="right">
                  {/* Struck through when the hours moved no balance — voided,
                      rescheduled, or given out of plan. The number still reads,
                      because the time was still spent. */}
                  <span
                    className={
                      voided || !chargesAllocation(s)
                        ? "text-muted-fg line-through tabular-nums"
                        : "font-semibold tabular-nums text-ink"
                    }
                  >
                    {formatMinutes(s.minutes)}
                  </span>
                </Td>
                <Td
                  label="Date"
                  className={`whitespace-nowrap tabular-nums ${voided ? "text-muted-fg" : "text-ink"}`}
                >
                  {formatDate(s.date)}
                </Td>
                <Td label="Task" className="sm:min-w-40 sm:max-w-56">
                  {s.assignment ? (
                    <ExpandableText
                      text={s.assignment.purpose}
                      lines={2}
                      className={`text-plan-ink ${voided ? "opacity-55" : ""}`}
                    />
                  ) : (
                    <span className="text-muted-fg">—</span>
                  )}
                </Td>
                <Td label="Notes" className="sm:max-w-md">
                  <div className={voided ? "opacity-55" : undefined}>
                    {s.note ? (
                      <ExpandableText text={s.note} />
                    ) : (
                      <span className="text-muted-fg">—</span>
                    )}
                  </div>
                  {/* What kind of meeting it was, when it wasn't the ordinary
                      kind. Voiding wins: those hours went back. */}
                  {(voided || state !== ATTENDANCE.ATTENDED || !s.withinPlan) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {voided ? (
                        <Chip tone="gray">Voided, hours returned</Chip>
                      ) : (
                        <>
                          {state !== ATTENDANCE.ATTENDED && (
                            <Chip tone={ATTENDANCE_META[state].tone ?? "gray"}>
                              {ATTENDANCE_META[state].chip}
                            </Chip>
                          )}
                          {!s.withinPlan && (
                            <Chip tone="gray">
                              {TIME_KIND_META[timeKindOf(s)].chip}
                            </Chip>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Td>
                {withActions && (
                  <Td align="right" className="align-top">
                    {hasActions(s) && (
                      <SessionRowActions
                        session={{
                          id: s.id,
                          minutes: s.minutes,
                          date: toDateInputValue(s.date),
                          attendance: state,
                          timeKind: timeKindOf(s),
                          note: s.note,
                          assignmentId: s.assignment?.id ?? null,
                        }}
                        goals={manage?.tasksBySession?.[s.id] ?? []}
                        canEdit={canEdit(s)}
                        canDelete={canDelete()}
                      />
                    )}
                  </Td>
                )}
              </Tr>
            );
          })}
        </Table>
      )}
    </Panel>
  );
}
