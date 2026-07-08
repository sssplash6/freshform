import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mentorAssignments } from "@/lib/queries";

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

  // A mentor's students are the ones an admin allocated hours to FROM this
  // mentor; sessions the mentor logs draw those allocations down.
  const [assignments, allocations, mySessionSums, delivered] =
    await Promise.all([
      mentorAssignments(user.id),
      prisma.hourAllocation.findMany({
        where: { mentorId: user.id },
        include: {
          student: {
            include: {
              user: true,
              cohort: { include: { program: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.session.groupBy({
        by: ["studentId"],
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
      }),
      prisma.session.aggregate({
        where: { mentorId: user.id, status: SESSION_STATUS.ACTIVE },
        _sum: { hours: true },
        _count: true,
      }),
    ]);

  const completedByStudent = new Map(
    mySessionSums.map((s) => [s.studentId, s._sum.hours ?? 0])
  );
  const students = allocations.map((a) => {
    const completed = completedByStudent.get(a.studentId) ?? 0;
    return {
      profile: a.student,
      allocated: a.hours,
      completed,
      remaining: a.hours - completed,
      approved: a.student.user.status === USER_STATUS.ACTIVE,
    };
  });

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
        <StatCard label="Sessions logged" value={String(delivered._count)} />
        <StatCard
          label="Hours delivered"
          value={formatHours(delivered._sum.hours ?? 0)}
          tone="brand"
        />
        <StatCard label="Cohorts" value={String(assignments.length)} />
      </StatCardGrid>

      <LogSessionForm
        students={students
          .filter((s) => s.approved)
          .map((s) => ({
            profileId: s.profile.id,
            label: `${s.profile.user.name ?? s.profile.user.email} — ${formatHours(s.remaining)}h left with you (${s.profile.cohort.name})`,
          }))}
      />

      {students.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          No students have hours allocated with you yet — an admin assigns
          those.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Program</th>
                <th className="px-3 py-2">Cohort</th>
                <th className="px-3 py-2 text-right">Allocated to you</th>
                <th className="px-3 py-2 text-right">Completed</th>
                <th className="px-3 py-2 text-right">Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {students.map((s) => (
                <tr
                  key={s.profile.id}
                  className="transition-colors hover:bg-mist/20"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      {s.profile.user.name ?? "—"}
                      {!s.approved && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700">
                          Pending approval
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.profile.user.email}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {s.profile.cohort.program.name}
                  </td>
                  <td className="px-3 py-2">{s.profile.cohort.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatHours(s.allocated)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatHours(s.completed)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium tabular-nums ${
                      s.remaining < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatHours(s.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
