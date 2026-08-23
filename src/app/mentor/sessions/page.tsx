import { Chip } from "@/components/chip";
import { SessionRowActions } from "@/components/forms/session-row-actions";
import { Select } from "@/components/select";
import { Button, LinkButton } from "@/components/ui/button";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import {
  ATTENDANCE,
  ATTENDANCE_META,
  attendanceOf,
  SESSION_STATUS,
} from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDate, formatHours, toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";

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
        by: ["attended"],
        where: { ...where, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
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

  const activeHours = byAttendance.reduce(
    (sum, row) => sum + (row._sum.hours ?? 0),
    0
  );
  const activeCount = byAttendance.reduce((sum, row) => sum + row._count, 0);
  const missedHours = byAttendance
    .filter((row) => !row.attended)
    .reduce((sum, row) => sum + (row._sum.hours ?? 0), 0);

  const params = { student, program, from, to };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">My sessions</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          {formatHours(activeHours)} active hours logged across {activeCount}{" "}
          sessions
          {missedHours > 0
            ? `, including ${formatHours(missedHours)} missed to no-shows`
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
              <div className="overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted-fg">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3 text-right">Hours</th>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {sessions.map((s) => {
                      const voided = s.status === SESSION_STATUS.VOIDED;
                      return (
                        <tr key={s.id} className={voided ? "opacity-50" : ""}>
                          <td className="px-4 py-3 tabular-nums">
                            {formatDate(s.date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink">
                              {s.student.user.name ?? s.student.user.email}
                            </div>
                            <div className="text-xs text-muted-fg">
                              {s.student.program.name}
                              {s.student.cohort
                                ? ` / ${s.student.cohort.name}`
                                : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatHours(s.hours)}
                          </td>
                          <td className="max-w-56 truncate px-4 py-3 text-plan-ink">
                            {s.assignment?.purpose ?? "—"}
                          </td>
                          <td className="max-w-56 truncate px-4 py-3 text-muted-fg">
                            {s.note ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {voided ? (
                              <Chip tone="gray">Voided</Chip>
                            ) : attendanceOf(s) === ATTENDANCE.ATTENDED ? (
                              <Chip tone="green">Logged</Chip>
                            ) : (
                              <Chip
                                tone={
                                  ATTENDANCE_META[attendanceOf(s)].tone ?? "gray"
                                }
                              >
                                {ATTENDANCE_META[attendanceOf(s)].label}
                              </Chip>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!voided && (
                              <SessionRowActions
                                session={{
                                  id: s.id,
                                  hours: s.hours,
                                  date: toDateInputValue(s.date),
                                  attendance: attendanceOf(s),
                                  note: s.note,
                                  assignmentId: s.assignmentId,
                                }}
                                goals={goalsByStudent.get(s.studentId) ?? []}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
