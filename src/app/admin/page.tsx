import Link from "next/link";

import { ArrowLink } from "@/components/arrow-link";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { CreateProgramForm } from "@/components/forms/program-forms";
import { ArrowRightIcon } from "@/components/icons";
import { ProgramIslandCard } from "@/components/program-island-card";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { Callout } from "@/components/ui/callout";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { ensureDeadlineReminders } from "@/lib/deadline-reminders";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, type StudentWithHours } from "@/lib/queries";

function totals(students: StudentWithHours[]) {
  return students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, remaining: 0 }
  );
}

/**
 * Cross-program dashboard: one island per running program with its vitals;
 * each island expands into the program's own page with everything in it.
 * Pending self-signups are approved right here.
 */
export default async function AdminHomePage() {
  await ensureDeadlineReminders();

  const [programs, students, assignments, unassignedMentors] =
    await Promise.all([
      prisma.program.findMany({
        include: { cohorts: true },
        orderBy: { name: "asc" },
      }),
      studentsWithHours(),
      prisma.mentorAssignment.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.user.count({
        where: { role: ROLES.MENTOR, status: USER_STATUS.UNASSIGNED },
      }),
    ]);

  const overall = totals(students);
  const pending = students.filter(
    (s) => s.user.status === USER_STATUS.PENDING
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Cross-program dashboard
        </h1>
        {unassignedMentors > 0 && (
          <Link
            href="/admin/mentors"
            className="group inline-flex items-center gap-1.5 rounded-md border border-brand/60 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand-deep transition-colors hover:bg-brand/10"
          >
            {unassignedMentors} mentor{unassignedMentors === 1 ? "" : "s"}{" "}
            awaiting assignment
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {pending.length > 0 && (
        <Callout
          tone="warning"
          title={`Pending approvals (${pending.length})`}
        >
          These students signed up themselves. Approve them, then allocate
          their hours from mentors in their program via “Manage”.
          <ul className="mt-3 divide-y divide-amber-200">
            {pending.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {s.user.name ?? s.user.email}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.user.email} · {s.program.name}
                    {s.cohort ? ` / ${s.cohort.name}` : ""}
                    {s.telegramUsername ? ` · @${s.telegramUsername}` : ""} ·
                    signed up {formatDate(s.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ApproveStudentButtons studentProfileId={s.id} />
                  <ArrowLink
                    href={`/admin/students/${s.id}`}
                    className="text-[13px]"
                  >
                    Manage
                  </ArrowLink>
                </div>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Hours allotted" value={formatHours(overall.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(overall.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(overall.remaining)}
          tone={overall.remaining < 0 ? "danger" : "default"}
        />
      </StatCardGrid>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-navy">
            Programs currently running
          </h2>
          <CreateProgramForm />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => {
            const ps = students.filter((s) => s.programId === p.id);
            const pt = totals(ps);
            const mentorCount = new Set(
              assignments
                .filter((a) => a.programId === p.id)
                .map((a) => a.mentorId)
            ).size;
            return (
              <ProgramIslandCard
                key={p.id}
                name={p.name}
                href={`/admin/programs/${p.id}`}
                cohortCount={p.cohorts.length}
                stats={[
                  { label: "Students", value: String(ps.length) },
                  { label: "Mentors", value: String(mentorCount) },
                  {
                    label: "Hrs left",
                    value: formatHours(pt.remaining),
                    danger: pt.remaining < 0,
                    brand: pt.remaining >= 0,
                  },
                ]}
                caption={`${formatHours(pt.completed)} of ${formatHours(pt.allotted)} hours completed`}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
