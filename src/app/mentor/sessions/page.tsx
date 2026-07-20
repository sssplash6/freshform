import Link from "next/link";

import { Chip } from "@/components/chip";
import { SessionRowActions } from "@/components/forms/session-row-actions";
import { Select } from "@/components/select";
import { SESSION_STATUS } from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
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
  }>;
}) {
  const user = await requireMentor();
  const {
    student = "",
    program = "",
    from = "",
    to = "",
  } = await searchParams;

  const sessions = await prisma.session.findMany({
    where: { mentorId: user.id },
    include: { student: { include: { user: true, program: true, cohort: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Filter choices come from the sessions themselves, so a mentor only ever
  // sees students/programs they actually logged sessions with.
  const studentOptions = [
    ...new Map(
      sessions.map((s) => [
        s.studentId,
        s.student.user.name ?? s.student.user.email,
      ])
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const programOptions = [
    ...new Map(
      sessions.map((s) => [s.student.programId, s.student.program.name])
    ),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const fromDate = parseFilterDate(from);
  const toDate = parseFilterDate(to);
  const filtering = Boolean(student || program || fromDate || toDate);
  const filtered = sessions.filter((s) => {
    if (student && s.studentId !== student) return false;
    if (program && s.student.programId !== program) return false;
    if (fromDate && s.date < fromDate) return false;
    if (toDate && s.date > toDate) return false;
    return true;
  });

  const totalActiveHours = filtered
    .filter((s) => s.status === SESSION_STATUS.ACTIVE)
    .reduce((sum, s) => sum + s.hours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">My sessions</h1>
        <p className="mt-1.5 text-base text-muted-fg">
          {formatHours(totalActiveHours)} active hours logged across{" "}
          {filtered.filter((s) => s.status === SESSION_STATUS.ACTIVE).length}{" "}
          sessions.
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-line bg-surface p-8 text-[15px] text-muted-fg">
          No sessions logged yet.
        </p>
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4">
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
                className="mt-0.5 block min-h-11 rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-fg">To</span>
              <input
                type="date"
                name="to"
                defaultValue={toDate ? to : ""}
                className="mt-0.5 block min-h-11 rounded-md border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="min-h-11 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Filter
            </button>
            {filtering && (
              <Link
                href="/mentor/sessions"
                className="min-h-11 rounded-md border border-line px-4 py-2.5 text-sm font-medium text-muted-fg transition-colors hover:border-brand/40 hover:text-ink"
              >
                Clear
              </Link>
            )}
          </form>

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-8 text-[15px] text-muted-fg">
              No sessions match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted-fg">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3 text-right">Hours</th>
                    <th className="px-4 py-3">Task</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {filtered.map((s) => {
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
                            {s.student.cohort ? ` / ${s.student.cohort.name}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatHours(s.hours)}
                        </td>
                        <td className="max-w-56 truncate px-4 py-3 text-muted-fg">
                          {s.task ?? "—"}
                        </td>
                        <td className="max-w-56 truncate px-4 py-3 text-muted-fg">
                          {s.note ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {voided ? (
                            <Chip tone="gray">Voided</Chip>
                          ) : (
                            <Chip tone="green">Active</Chip>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!voided && (
                            <SessionRowActions
                              session={{
                                id: s.id,
                                hours: s.hours,
                                date: formatDate(s.date),
                                task: s.task,
                                note: s.note,
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
