import { SessionRowActions } from "@/components/forms/session-row-actions";
import { SessionsTable, toSessionEntries } from "@/components/session-row";
import { Select } from "@/components/select";
import { Button, LinkButton } from "@/components/ui/button";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import {
  attendanceOf,
  timeKindOf,
  SESSION_STATUS,
} from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDuration, toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";

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
  // One instant for the whole page: every chip and window is judged against it.
  const viewer = { audience: "mentor" as const, userId: user.id, now: new Date() };
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
  // Keyed by SESSION, not by student: a row's menu offers the tasks that row
  // could be re-attached to, and `SessionsTable` hands the renderer a row.
  const goalsByStudentId = new Map<string, { value: string; label: string }[]>();
  for (const g of myGoals) {
    const list = goalsByStudentId.get(g.studentId) ?? [];
    list.push({ value: g.id, label: g.purpose });
    goalsByStudentId.set(g.studentId, list);
  }
  const goalsBySession: Record<string, { value: string; label: string }[]> =
    Object.fromEntries(
      sessions.map((s) => [s.id, goalsByStudentId.get(s.studentId) ?? []])
    );

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
        <EmptyState title="No sessions logged">
          Your first logged meeting starts this ledger.
        </EmptyState>
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
            <EmptyState variant="no-results" title="No sessions match">
              Your filters exclude every session. Reset them to see the rest.
            </EmptyState>
          ) : (
            <>
              <SessionsTable
                // Every row is this mentor's, so the query never fetched a
                // mentor to put on it; the table drops the column anyway.
                sessions={toSessionEntries(
                  sessions.map((row) => ({ ...row, mentor: user }))
                )}
                viewer={viewer}
                columns={["date", "student", "duration", "task", "notes"]}
                renderActions={(row) =>
                  row.status === SESSION_STATUS.VOIDED ? null : (
                    <SessionRowActions
                      session={{
                        id: row.id,
                        minutes: row.minutes,
                        date: toDateInputValue(row.date),
                        attendance: attendanceOf(row),
                        timeKind: timeKindOf(row),
                        note: row.note,
                        assignmentId: row.task?.id ?? null,
                      }}
                      goals={goalsBySession[row.id] ?? []}
                    />
                  )
                }
              />
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
