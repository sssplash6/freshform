import Link from "next/link";

import { Chip } from "@/components/chip";
import { PersonChip } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";

/**
 * Structural, not Prisma-derived: the same table serves one student's ledger
 * and the cross-student log on a dashboard, which are different queries.
 */
export type LoggedMeeting = {
  id: string;
  hours: number;
  date: Date;
  attended: boolean;
  task: string | null;
  note: string | null;
  status: string;
  mentor: { id: string; name: string | null; email: string };
  /** Present only on cross-student logs, where a Student column is needed. */
  student?: { id: string; user: { name: string | null; email: string } } | null;
  /** The assigned goal this meeting went toward; null on pre-goals history. */
  assignment?: { id: string; purpose: string } | null;
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
  /** Shown in the header when the log is a truncated slice of a longer one. */
  moreHref?: string;
  moreLabel?: string;
}) {
  const active = sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE);
  const loggedHours = active.reduce((sum, s) => sum + s.hours, 0);
  const withStudent = sessions.some((s) => s.student);
  // On a mentor's own log every row is them, so the Team column would just
  // repeat one name down the page. Drop it unless the log spans people.
  const withTeam = new Set(sessions.map((s) => s.mentor.id)).size > 1;

  const columns: Column[] = [
    ...(withTeam ? [{ label: "Team" } as Column] : []),
    ...(withStudent ? [{ label: "Student" } as Column] : []),
    { label: "Duration", align: "right" },
    { label: "Date" },
    { label: "Goal" },
    { label: "Notes" },
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
                      voided
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
                    {s.task ? (
                      <div className="text-ink">{s.task}</div>
                    ) : (
                      !s.note && <span className="text-muted-fg">—</span>
                    )}
                    {s.note && (
                      <div className={s.task ? "text-xs text-muted-fg" : "text-ink"}>
                        {s.note}
                      </div>
                    )}
                  </div>
                  {(voided || !s.attended) && (
                    <div className="mt-1.5">
                      {voided ? (
                        <Chip tone="gray">Voided, hours returned</Chip>
                      ) : (
                        <Chip tone="amber">No-show, hours still charged</Chip>
                      )}
                    </div>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}
    </Panel>
  );
}
