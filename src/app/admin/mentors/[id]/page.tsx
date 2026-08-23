import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/chip";
import { Deadline } from "@/components/deadline";
import { MeetingsLog } from "@/components/meetings-log";
import {
  MentorHoursFilter,
  resolveWindow,
  type HoursQuery,
} from "@/components/mentor-hours-filter";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { initials, personBanner } from "@/lib/person-tone";
import { prisma } from "@/lib/prisma";
import { mentorAssignments, mentorOverview, mentorPrograms } from "@/lib/queries";

/** How many meetings the log shows before it stops; the tallies stay complete. */
const LOG_LIMIT = 30;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Admin detail page for one mentor: what they have delivered, across which
 * programs, to whom, and lately. Every mentor chip in the admin area lands
 * here.
 *
 * The page reads through a window the admin sets — a program, a period, or a
 * typed range — and keeps two kinds of number honestly apart: hours DELIVERED
 * inside that window, and the BALANCES (allocated, remaining) that a date range
 * has no bearing on. Panel captions say which is which.
 */
export default async function AdminMentorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<HoursQuery>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const mentor = await prisma.user.findUnique({ where: { id } });
  // The same pool the mentors list draws from: plain mentors, plus dual-role
  // admins flagged as mentors.
  if (!mentor || (mentor.role !== ROLES.MENTOR && !mentor.isMentor)) {
    notFound();
  }

  const programs = await mentorPrograms(mentor.id);
  const programId = programs.some((p) => p.id === query.program)
    ? query.program
    : undefined;
  const win = resolveWindow(query);

  const [overview, assignments, feedback] = await Promise.all([
    mentorOverview(mentor.id, { programId, from: win.from, to: win.to }),
    mentorAssignments(mentor.id),
    prisma.mentorFeedback.aggregate({
      where: { mentorId: mentor.id },
      _avg: { rating: true },
      _count: true,
    }),
  ]);

  const { totals } = overview;
  const scope = programs.find((p) => p.id === programId)?.name ?? null;
  const name = mentor.name ?? mentor.email;
  const rated = feedback._count > 0 && feedback._avg.rating != null;
  const shownMeetings = overview.sessions.slice(0, LOG_LIMIT);
  const loggedHours = totals.delivered + totals.missed;

  const logCaption =
    totals.sessions === 0
      ? `Nothing logged over ${win.label}`
      : `${totals.sessions} meeting${totals.sessions === 1 ? "" : "s"} · ${formatHours(loggedHours)} hours${
          overview.sessions.length > shownMeetings.length
            ? ` · showing the ${LOG_LIMIT} most recent`
            : ""
        }`;

  const studentColumns: Column[] = [
    { label: "Student" },
    ...(scope ? [] : [{ label: "Program" } as Column]),
    { label: "Allocated", align: "right" },
    { label: "Completed", align: "right" },
    { label: "Missed", align: "right" },
    { label: "Remaining", align: "right" },
    { label: "Use by" },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <PageHeader
          backHref="/admin/mentors"
          backLabel="Mentors"
          eyebrow="Mentor"
          programTone={personBanner(mentor.id)}
          monogram={initials(mentor.name, mentor.email)}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {name}
              {mentor.role === ROLES.ADMIN && (
                <Chip tone="green">Admin · also mentor</Chip>
              )}
              {mentor.status === USER_STATUS.UNASSIGNED && (
                <Chip tone="amber">Awaiting assignment</Chip>
              )}
            </span>
          }
          // Deliberately just who they are and since when. The student count and
          // the hours still to deliver are read off the stat strip below, and a
          // banner that repeats them makes the same number look like two facts.
          subtitle={
            <>
              {mentor.email} · registered {formatDate(mentor.createdAt)}
            </>
          }
          // This page is the delivery record; the profile is the picture, name
          // and booking links the mentor maintains themself.
          actions={
            <LinkButton
              href={`/mentors/${mentor.id}`}
              variant="secondary"
              size="sm"
            >
              View profile
            </LinkButton>
          }
        />
        {assignments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {assignments.map((a) => (
              <Chip key={a.id} tone={a.calendlyUrl ? "green" : "gray"}>
                {a.cohort
                  ? `${a.program.name} / ${a.cohort.name}`
                  : a.program.name}
                {a.calendlyUrl ? " · booking link set" : " · no booking link"}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/*
        One panel for the whole hours view: the controls, the totals they
        produce, and the per-program breakdown behind those totals. These used to
        be three separate cards, which left the numbers looking unrelated to the
        filter that had just decided them.
      */}
      <Panel tone="total">
        <PanelHeader
          tone="total"
          eyebrow="Hours"
          title="Delivery record"
          caption={`Delivered and missed cover ${win.label}; allocated and remaining are balances as of today`}
        />

        <MentorHoursFilter
          base={`/admin/mentors/${mentor.id}`}
          programs={programs}
          programId={programId}
          window={win}
          framed={false}
        />

        {/* The window the numbers below were read through, stated once. */}
        <div className="border-t border-line px-4 sm:px-5">
          <p className="pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
            {capitalize(win.label)} · {scope ?? "all programs"}
          </p>
          <StatCardGrid framed={false} className="pt-4">
            <StatCard
              label="Hours delivered"
              value={formatHours(totals.delivered)}
              tone="brand"
              lead
            />
            <StatCard label="Meetings" value={String(totals.sessions)} />
            {totals.missed > 0 && (
              <StatCard label="Hours missed" value={formatHours(totals.missed)} />
            )}
            <StatCard label="Students" value={String(totals.students)} />
            <StatCard
              label="Hours remaining"
              value={formatHours(totals.remaining)}
              tone={totals.remaining < 0 ? "danger" : "default"}
            />
            {rated && (
              <StatCard
                label={`Rating · ${feedback._count}`}
                value={feedback._avg.rating!.toFixed(1)}
                tone="muted"
              />
            )}
          </StatCardGrid>
        </div>

        <div className="border-t border-line px-4 pt-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-fg">
            Across the programs
          </p>
        </div>
        {overview.byProgram.length === 0 ? (
          <EmptyState framed={false} title="No hours here yet">
            Once this mentor holds a student&apos;s hours or logs a session,
            each program they work in gets a line here.
          </EmptyState>
        ) : (
          <>
            <Table
              framed={false}
              columns={[
                { label: "Program" },
                { label: "Students", align: "right" },
                { label: "Meetings", align: "right" },
                { label: "Delivered", align: "right" },
                { label: "Missed", align: "right" },
                { label: "Allocated", align: "right" },
                { label: "Remaining", align: "right" },
              ]}
            >
              {overview.byProgram.map((row, i) => {
                // The meter belongs to the balance half of the row: hours
                // consumed plus any forfeited past a deadline, over allocated.
                const gone = row.used + row.forfeited;
                const pct =
                  row.allocated > 0
                    ? Math.min(100, Math.round((gone / row.allocated) * 100))
                    : 0;
                return (
                  <Tr
                    key={row.id}
                    className="deal-in"
                    style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
                  >
                    <Td className="sm:min-w-52">
                      <Link
                        href={`/admin/programs/${row.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {row.name}
                      </Link>
                      {row.allocated > 0 && (
                        <Meter
                          className="mt-2 max-w-44"
                          size="sm"
                          pct={row.remaining < 0 ? 100 : pct}
                          tone={row.remaining < 0 ? "danger" : "accent"}
                          ariaValueNow={gone}
                          ariaValueMax={row.allocated}
                          ariaLabel={`Hours used in ${row.name}`}
                        />
                      )}
                    </Td>
                    <Td label="Students" align="right" className="tabular-nums">
                      {row.students}
                    </Td>
                    <Td
                      label="Meetings"
                      align="right"
                      className="tabular-nums text-muted-fg"
                    >
                      {row.sessions}
                    </Td>
                    <Td
                      label="Delivered"
                      align="right"
                      className="font-semibold tabular-nums text-ink"
                    >
                      {formatHours(row.delivered)}
                    </Td>
                    <Td
                      label="Missed"
                      align="right"
                      className={`tabular-nums ${
                        row.missed > 0 ? "text-amber-700" : "text-muted-fg"
                      }`}
                    >
                      {row.missed > 0 ? formatHours(row.missed) : "—"}
                    </Td>
                    <Td label="Allocated" align="right" className="tabular-nums">
                      {formatHours(row.allocated)}
                    </Td>
                    <Td
                      label="Remaining"
                      align="right"
                      className={`font-medium tabular-nums ${
                        row.remaining < 0 ? "text-red-700" : "text-ink"
                      }`}
                    >
                      {formatHours(row.remaining)}
                    </Td>
                  </Tr>
                );
              })}
            </Table>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line bg-canvas px-4 py-3 text-xs sm:px-5">
              <span className="text-muted-fg">
                <span className="font-semibold tabular-nums text-ink">
                  {formatHours(totals.delivered)}
                </span>{" "}
                hours delivered over {win.label}
                {totals.missed > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold tabular-nums text-amber-700">
                      {formatHours(totals.missed)}
                    </span>{" "}
                    missed
                  </>
                )}
              </span>
              <span className="text-muted-fg">
                <span className="font-semibold tabular-nums text-ink">
                  {formatHours(totals.remaining)}
                </span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {formatHours(totals.allocated)}
                </span>{" "}
                allocated hours still to deliver
                {totals.forfeited > 0 && (
                  <>
                    {" · "}
                    <span className="font-semibold tabular-nums text-red-700">
                      {formatHours(totals.forfeited)}
                    </span>{" "}
                    expired unused
                  </>
                )}
              </span>
            </div>
          </>
        )}
      </Panel>

      <MeetingsLog
        sessions={shownMeetings}
        title="Recent meetings"
        eyebrow={`Logged by ${mentor.name?.split(" ")[0] ?? name}`}
        caption={logCaption}
        emptyBody={
          win.active === "all"
            ? "Every session this mentor logs shows up here, newest first."
            : "No sessions logged inside this window — widen the period above."
        }
      />

      <Panel tone="total">
        <PanelHeader
          tone="total"
          eyebrow="Holding hours from this mentor"
          title="Students"
          caption="Current balances — the period above doesn't move these"
        />
        {overview.students.length === 0 ? (
          <EmptyState framed={false} title="No students yet">
            An admin allocates a student&apos;s hours from a mentor on the
            student&apos;s own page; those students appear here.
          </EmptyState>
        ) : (
          <Table framed={false} columns={studentColumns}>
            {overview.students.map((s, i) => (
              <Tr
                key={s.student.id}
                className="deal-in"
                style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
              >
                <Td>
                  <Link
                    href={`/admin/students/${s.student.id}`}
                    className="group block"
                  >
                    <span className="flex items-center gap-2 font-medium text-ink group-hover:text-brand">
                      {s.student.user.name ?? s.student.user.email}
                      {s.student.user.status === USER_STATUS.PENDING && (
                        <Chip tone="amber">Pending approval</Chip>
                      )}
                    </span>
                    <span className="block text-xs text-muted-fg">
                      {s.student.user.email}
                    </span>
                  </Link>
                </Td>
                {!scope && (
                  <Td label="Program" className="whitespace-nowrap">
                    {s.student.program.name}
                    {s.student.cohort && (
                      <span className="block text-xs text-muted-fg">
                        {s.student.cohort.name}
                      </span>
                    )}
                  </Td>
                )}
                <Td label="Allocated" align="right" className="tabular-nums">
                  {formatHours(s.allocated)}
                </Td>
                <Td label="Completed" align="right" className="tabular-nums">
                  {formatHours(s.completed)}
                </Td>
                <Td
                  label="Missed"
                  align="right"
                  className={`tabular-nums ${
                    s.missed > 0 ? "text-amber-700" : "text-muted-fg"
                  }`}
                >
                  {s.missed > 0 ? formatHours(s.missed) : "—"}
                </Td>
                <Td
                  label="Remaining"
                  align="right"
                  className={`font-medium tabular-nums ${
                    s.remaining < 0 ? "text-red-700" : "text-ink"
                  }`}
                >
                  {formatHours(s.remaining)}
                </Td>
                <Td label="Use by" className="whitespace-nowrap">
                  <Deadline deadline={s.deadline} />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
