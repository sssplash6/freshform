import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mentorAssignments, studentsWithHours } from "@/lib/queries";

export default async function MentorHomePage() {
  const user = await requireRole(ROLES.MENTOR);

  if (user.status === USER_STATUS.UNASSIGNED) {
    return (
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-6">
        <h1 className="text-xl font-semibold text-navy">
          Welcome, {user.name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your mentor account is created but not yet assigned to any cohorts.
          An admin needs to assign you before you can see students or log
          sessions — check back soon.
        </p>
      </div>
    );
  }

  const assignments = await mentorAssignments(user.id);
  const [students, delivered] = await Promise.all([
    studentsWithHours({
      cohortId: { in: assignments.map((a) => a.cohortId) },
    }),
    prisma.session.aggregate({
      where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
      _sum: { hours: true },
      _count: true,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">My students</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cohorts:{" "}
          {assignments
            .map((a) => `${a.cohort.program.name} / ${a.cohort.name}`)
            .join(", ") || "none"}
        </p>
      </div>

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard
          label="Sessions logged"
          value={String(delivered._count)}
        />
        <StatCard
          label="Hours delivered"
          value={formatHours(delivered._sum.hours ?? 0)}
          tone="brand"
        />
        <StatCard
          label="Cohorts"
          value={String(assignments.length)}
        />
      </StatCardGrid>

      <LogSessionForm
        students={students.map((s) => ({
          profileId: s.id,
          label: `${s.user.name ?? s.user.email} — ${formatHours(s.remainingHours)}h left (${s.cohort.name})`,
        }))}
      />

      <StudentsTable students={students} showProgram />
    </div>
  );
}
