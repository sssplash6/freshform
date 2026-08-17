import Link from "next/link";

import { Chip } from "@/components/chip";
import { ExpandableNote } from "@/components/expandable-note";
import { PersonChip } from "@/components/person-chip";
import { SessionRowActions } from "@/components/forms/session-row-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { ATTENDANCE, ATTENDANCE_META, attendanceOf, SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours, toDateInputValue } from "@/lib/format";

/**
 * Structural, not Prisma-derived: the same table serves one student's ledger
 * and the cross-student log on a dashboard, which are different queries.
 */
export type LoggedMeeting = {
  id: string;
  hours: number;
  date: Date;
  attended: boolean;
  late: boolean;
  note: string | null;
  status: string;
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
 * are part of the history even though their hours went back.
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
  // part of the history, not of the hours.
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const loggedHours = active.reduce((sum, s) => sum + s.hours, 0);
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
      : `${active.length} meeting${active.length === 1 ? "" : "s"} · ${formatHours(loggedHours)} hours`);

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
                  <Td className={voided ? "opacity-45" : undefined}>
                    <PersonChip
                      person={s.mentor}
                      size="sm"
                      href={mentorBase && `${mentorBase}/${s.mentor.id}`}
                    />
                  </Td>
                )}
                {withStudent && (
                  <Td className={voided ? "opacity-55" : undefined}>
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
                <Td align="right">
                  <span
                    className={
                      voided || state === ATTENDANCE.RESCHEDULED
                        ? "text-muted-fg line-through tabular-nums"
                        : "font-semibold tabular-nums text-ink"
                    }
                  >
                    {formatHours(s.hours)}
                  </span>
                </Td>
                <Td
                  className={`whitespace-nowrap tabular-nums ${voided ? "text-muted-fg" : "text-ink"}`}
                >
                  {formatDate(s.date)}
                </Td>
                <Td className="max-w-56">
                  {s.assignment ? (
                    <span
                      className={`text-plan-ink ${voided ? "opacity-55" : ""}`}
                    >
                      {s.assignment.purpose}
                    </span>
                  ) : (
                    <span className="text-muted-fg">—</span>
                  )}
                </Td>
                <Td className="max-w-md">
                  <div className={voided ? "opacity-55" : undefined}>
                    {s.note ? (
                      <ExpandableNote text={s.note} />
                    ) : (
                      <span className="text-muted-fg">—</span>
                    )}
                  </div>
                  {/* What kind of meeting it was, when it wasn't the ordinary
                      kind. Voiding wins: those hours went back. */}
                  {(voided || state !== ATTENDANCE.ATTENDED) && (
                    <div className="mt-1.5">
                      {voided ? (
                        <Chip tone="gray">Voided, hours returned</Chip>
                      ) : (
                        <Chip tone={ATTENDANCE_META[state].tone ?? "gray"}>
                          {ATTENDANCE_META[state].chip}
                        </Chip>
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
                          hours: s.hours,
                          date: toDateInputValue(s.date),
                          attendance: state,
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
