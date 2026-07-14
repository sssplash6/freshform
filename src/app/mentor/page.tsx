import Link from "next/link";

import { Chip } from "@/components/chip";
import { ArrowLink } from "@/components/arrow-link";
import { BookingLinksForm } from "@/components/forms/booking-link-form";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mentorAssignments } from "@/lib/queries";

export default async function MentorHomePage() {
  const user = await requireMentor();

  if (user.status === USER_STATUS.UNASSIGNED) {
    return (
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Welcome, {user.name ?? user.email}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your mentor account is created but not yet assigned to a program.
          An admin needs to assign you before you can see students or log
          sessions, so check back soon.
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
            include: { user: true, program: true, cohort: true },
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

  // One island per program (item 6): mentors working across programs see
  // each program's students in its own box.
  const byProgram = new Map<string, typeof students>();
  for (const s of students) {
    const key = s.profile.program.name;
    if (!byProgram.has(key)) byProgram.set(key, []);
    byProgram.get(key)!.push(s);
  }
  const programCount = new Set(assignments.map((a) => a.programId)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">My students</h1>
        <p className="mt-1.5 text-base text-gray-500">
          Assigned to:{" "}
          {assignments
            .map((a) =>
              a.cohort ? `${a.program.name} / ${a.cohort.name}` : a.program.name
            )
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
        <StatCard label="Programs" value={String(programCount)} />
      </StatCardGrid>

      {assignments.length > 0 && (
        <BookingLinksForm
          assignments={assignments.map((a) => ({
            id: a.id,
            label: a.cohort
              ? `${a.program.name} / ${a.cohort.name}`
              : a.program.name,
            calendlyUrl: a.calendlyUrl,
          }))}
        />
      )}

      <LogSessionForm
        students={students
          .filter((s) => s.approved)
          .map((s) => ({
            profileId: s.profile.id,
            label: `${s.profile.user.name ?? s.profile.user.email} · ${formatHours(s.remaining)}h left with you (${s.profile.program.name})`,
          }))}
      />

      {students.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
          No students have hours allocated with you yet. An admin assigns
          those.
        </p>
      ) : (
        [...byProgram.entries()].map(([programName, programStudents]) => (
          <section
            key={programName}
            className="rounded-lg border border-mist bg-white"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist px-4 py-3">
              <h2 className="text-base font-semibold text-navy">
                {programName}
              </h2>
              <p className="text-xs text-gray-500">
                {programStudents.length} student
                {programStudents.length === 1 ? "" : "s"} ·{" "}
                {formatHours(
                  programStudents.reduce((sum, s) => sum + s.remaining, 0)
                )}{" "}
                hours remaining with you
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3">Cohort</th>
                    <th className="px-4 py-3 text-right">Allocated to you</th>
                    <th className="px-4 py-3 text-right">Completed</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist/60">
                  {programStudents.map((s) => (
                    <tr
                      key={s.profile.id}
                      className="transition-colors hover:bg-mist/20"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/mentor/students/${s.profile.id}`}
                          className="group block"
                        >
                          <span className="flex items-center gap-2 font-medium text-gray-900 group-hover:text-navy">
                            {s.profile.user.name ?? "—"}
                            {!s.approved && (
                              <Chip tone="amber">Pending approval</Chip>
                            )}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {s.profile.user.email}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {s.profile.telegramUsername
                          ? `@${s.profile.telegramUsername}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {s.profile.cohort?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(s.allocated)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(s.completed)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          s.remaining < 0 ? "text-red-700" : "text-navy"
                        }`}
                      >
                        {formatHours(s.remaining)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowLink
                          href={`/mentor/students/${s.profile.id}`}
                          className="text-[13px]"
                        >
                          View
                        </ArrowLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}
