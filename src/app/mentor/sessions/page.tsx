import { SessionRowActions } from "@/components/forms/session-row-actions";
import { Select } from "@/components/select";
import { Button, LinkButton } from "@/components/ui/button";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import {
  ATTENDANCE,
  ATTENDANCE_META,
  attendanceOf,
  timeKindOf,
  SESSION_STATUS,
} from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDate, formatDuration, formatMinutes, toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { StatusChip } from "@/components/ui/status-chip";
import { severityOrNeutral } from "@/lib/status";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD query param → UTC-midnight Date, or null when absent/invalid. */
function parseFilterDate(raw: string): Date | null {
  if (!DATE_RE.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function MentorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    student?: string;
    program?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const user = await requireMentor();
  const {
    student = "",
    program = "",
    from = "",
    to = "",
    page: rawPage,
  } = await searchParams;
  const page = parsePage(rawPage);

  const fromDate = parseFilterDate(from);
  const toDate = parseFilterDate(to);
  const filtering = Boolean(student || program || fromDate || toDate);

  // The filters are the WHERE clause, not a pass over everything this mentor
  // ever logged: a few years of sessions is not a list to read into memory and
  // sift in JavaScript, and the totals below have to describe the whole filtered
  // set anyway — which only the database can answer once the page is a slice.
  const where = {
    mentorId: user.id,
    ...(student ? { studentId: student } : {}),
    ...(program ? { student: { programId: program } } : {}),
    ...(fromDate || toDate
      ? {
          date: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  };

  const [sessions, total, everLogged, byAttendance, loggedStudentIds] =
    await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          student: { include: { user: true, program: true, cohort: true } },
          assignment: { select: { id: true, purpose: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.session.count({ where }),
      prisma.session.count({ where: { mentorId: user.id } }),
      // Totals over every session the filters match, page or no page.
      prisma.session.groupBy({
        by: ["attended", "withinPlan"],
        where: { ...where, status: SESSION_STATUS.ACTIVE },
        _sum: { minutes: true },
        _count: true,
      }),
      // Filter choices come from the sessions themselves, so a mentor only ever
      // sees students they actually logged sessions with.
      prisma.session.groupBy({
        by: ["studentId"],
        where: { mentorId: user.id },
      }),
    ]);

  const loggedStudents = await prisma.studentProfile.findMany({
    where: { id: { in: loggedStudentIds.map((s) => s.studentId) } },
    include: { user: true, program: true },
  });

  // This mentor's tasks for the students on THIS page, so a session's task can
  // be corrected from its row.
  const myGoals = await prisma.assignment.findMany({
    where: {
      mentorId: user.id,
      studentId: { in: [...new Set(sessions.map((s) => s.studentId))] },
    },
    orderBy: [{ studentId: "asc" }, { position: "asc" }],
    select: { id: true, studentId: true, purpose: true },
  });
  const goalsByStudent = new Map<string, { value: string; label: string }[]>();
  for (const g of myGoals) {
    const list = goalsByStudent.get(g.studentId) ?? [];
    list.push({ value: g.id, label: g.purpose });
    goalsByStudent.set(g.studentId, list);
  }

  const studentOptions = loggedStudents
    .map((s) => ({
      value: s.id,
      label: s.user.name ?? s.user.email,
      hint: s.program.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const programOptions = [
    ...new Map(loggedStudents.map((s) => [s.programId, s.program.name])),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Hours charged vs. hours given: an out-of-plan session is time this mentor
  // spent, so it counts in the session tally, but it drew nobody's balance
  // down and so is stated apart from the hours total.
  const activeMinutes = byAttendance
    .filter((row) => row.withinPlan)
    .reduce((sum, row) => sum + (row._sum.minutes ?? 0), 0);
  const extraMinutes = byAttendance
    .filter((row) => !row.withinPlan)
    .reduce((sum, row) => sum + (row._sum.minutes ?? 0), 0);
  const activeCount = byAttendance.reduce((sum, row) => sum + row._count, 0);
  const missedMinutes = byAttendance
    .filter((row) => row.withinPlan && !row.attended)
    .reduce((sum, row) => sum + (row._sum.minutes ?? 0), 0);

  const params = { student, program, from, to };

  const columns: Column[] = [
    { label: "Date" },
    { label: "Student" },
    { label: "Duration", align: "right" },
    { label: "Task" },
    { label: "Notes" },
    { label: "Status" },
    { label: "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">My sessions</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          {formatDuration(activeMinutes)} active hours logged across {activeCount}{" "}
          sessions
          {missedMinutes > 0
            ? `, including ${formatDuration(missedMinutes)} missed to no-shows`
            : ""}
          {extraMinutes > 0
            ? `, plus ${formatDuration(extraMinutes)} given outside the plan`
            : ""}
          .
        </p>
      </div>

      {everLogged === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          No sessions logged yet.
        </p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
            <label className="block text-sm">
              <span className="text-muted-fg">Student</span>
              <div className="mt-0.5 w-48">
                <Select
                  name="student"
                  ariaLabel="Filter by student"
                  options={studentOptions}
                  placeholder="All students"
                  defaultValue={student}
                  required={false}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-muted-fg">Program</span>
              <div className="mt-0.5 w-48">
                <Select
                  name="program"
                  ariaLabel="Filter by program"
                  options={programOptions}
                  placeholder="All programs"
                  defaultValue={program}
                  required={false}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="text-muted-fg">From</span>
              <input
                type="date"
                name="from"
                defaultValue={fromDate ? from : ""}
                className="mt-0.5 block min-h-11 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-fg">To</span>
              <input
                type="date"
                name="to"
                defaultValue={toDate ? to : ""}
                className="mt-0.5 block min-h-11 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none"
              />
            </label>
            <Button type="submit">Filter</Button>
            {filtering && (
              <LinkButton href="/mentor/sessions" variant="secondary">
                Clear
              </LinkButton>
            )}
          </form>

          {sessions.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
              No sessions match these filters.
            </p>
          ) : (
            <>
              <Table columns={columns}>
                {sessions.map((s) => {
                  const voided = s.status === SESSION_STATUS.VOIDED;
                  return (
                    <Tr key={s.id} className={voided ? "opacity-50" : ""}>
                      <Td label="Date" className="tabular-nums">
                        {formatDate(s.date)}
                      </Td>
                      <Td label="Student">
                        <span className="font-medium text-ink">
                          {s.student.user.name ?? s.student.user.email}
                        </span>
                        <span className="block text-xs text-muted-fg">
                          {s.student.program.name}
                          {s.student.cohort ? ` / ${s.student.cohort.name}` : ""}
                        </span>
                      </Td>
                      <Td label="Duration" align="right" className="tabular-nums">
                        <span
                          className={
                            s.withinPlan ? undefined : "text-muted-fg line-through"
                          }
                        >
                          {formatMinutes(s.minutes)}
                        </span>
                      </Td>
                      <Td
                        label="Task"
                        className="text-ink sm:max-w-56 sm:truncate"
                      >
                        {s.assignment?.purpose ?? "—"}
                      </Td>
                      <Td
                        label="Notes"
                        className="text-muted-fg sm:max-w-56 sm:truncate"
                      >
                        {s.note ?? "—"}
                      </Td>
                      <Td label="Status">
                        <span className="flex flex-wrap gap-1.5">
                          {voided ? (
                            <StatusChip severity="neutral">
                              Voided, time returned
                            </StatusChip>
                          ) : attendanceOf(s) === ATTENDANCE.ATTENDED ? null : (
                            <StatusChip
                              severity={severityOrNeutral(
                                ATTENDANCE_META[attendanceOf(s)].status
                              )}
                            >
                              {ATTENDANCE_META[attendanceOf(s)].chip}
                            </StatusChip>
                          )}
                          {!voided && !s.withinPlan && (
                            <StatusChip severity="neutral">Extra, no time charged</StatusChip>
                          )}
                        </span>
                      </Td>
                      <Td>
                        {!voided && (
                          <SessionRowActions
                            session={{
                              id: s.id,
                              minutes: s.minutes,
                              date: toDateInputValue(s.date),
                              attendance: attendanceOf(s),
                              timeKind: timeKindOf(s),
                              note: s.note,
                              assignmentId: s.assignmentId,
                            }}
                            goals={goalsByStudent.get(s.studentId) ?? []}
                          />
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </Table>
              <Pagination
                basePath="/mentor/sessions"
                params={params}
                page={page}
                total={total}
                unit="sessions"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
