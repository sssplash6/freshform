import Link from "next/link";
import { notFound } from "next/navigation";

import { AllocateHoursForm } from "@/components/forms/allocate-hours-form";
import { Deadline } from "@/components/deadline";
import { ArrowLeftIcon } from "@/components/icons";
import { Chip } from "@/components/chip";
import { ApproveStudentButtons } from "@/components/forms/approve-student-buttons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentCorrections } from "@/components/forms/student-corrections";
import { USER_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
import { prisma } from "@/lib/prisma";
import {
  mentorsInProgram,
  programOptions,
  toProgramOptions,
} from "@/lib/queries";

/**
 * Admin detail page for one student: approve a pending self-signup and
 * manage the hours they hold with each mentor in their program. This is the
 * only place hour allocations are edited.
 */
export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: true,
      program: true,
      cohort: true,
      allotmentChanges: {
        include: { mentor: true, changedBy: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!profile) notFound();

  const isPending = profile.user.status === USER_STATUS.PENDING;
  const [mentors, hours, programs, sessionCount] = await Promise.all([
    mentorsInProgram(profile.programId),
    allocationSummary(profile.id),
    programOptions(),
    prisma.session.count({ where: { studentId: profile.id } }),
  ]);
  const byMentor = new Map(hours.perMentor.map((m) => [m.mentor.id, m]));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/students"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          All students
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-navy">
            {profile.user.name ?? profile.user.email}
          </h1>
          {isPending && (
            <Chip tone="amber">Pending approval</Chip>
          )}
        </div>
        <p className="mt-1.5 text-base text-gray-500">
          {profile.user.email} · {profile.program.name}
          {profile.cohort ? ` / ${profile.cohort.name}` : ""}
          {profile.telegramUsername ? (
            <>
              {" · Telegram "}
              <a
                href={`https://t.me/${profile.telegramUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-navy underline decoration-mist underline-offset-2 hover:decoration-navy"
              >
                @{profile.telegramUsername}
              </a>
            </>
          ) : (
            " · Telegram not set yet"
          )}{" "}
          · registered {formatDate(profile.createdAt)}
        </p>
      </div>

      {isPending && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">
            Approve this student
          </h2>
          <p className="mt-1 text-xs text-amber-700">
            Until approved, the student can&apos;t use their hours and mentors
            can&apos;t log sessions for them.
          </p>
          <div className="mt-3">
            <ApproveStudentButtons studentProfileId={profile.id} />
          </div>
        </section>
      )}

      <StatCardGrid>
        <StatCard label="Hours allotted" value={formatHours(hours.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(hours.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(hours.remaining)}
          tone={hours.remaining < 0 ? "danger" : "default"}
        />
        <StatCard label="Mentors" value={String(hours.perMentor.length)} />
      </StatCardGrid>

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Hour allocations by mentor
        </h2>
        {mentors.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            No mentors are assigned to {profile.program.name} yet. Assign
            mentors first, then allocate hours here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Mentor</th>
                  <th className="px-4 py-3 text-right">Allocated</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                  <th className="px-4 py-3">Use by</th>
                  <th className="px-4 py-3">Set allocation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {mentors.map((mentor) => {
                  const alloc = byMentor.get(mentor.id);
                  return (
                    <tr key={mentor.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {mentor.name ?? "—"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {mentor.email}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(alloc?.allocated ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(alloc?.completed ?? 0)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium tabular-nums ${
                          (alloc?.remaining ?? 0) < 0
                            ? "text-red-700"
                            : "text-navy"
                        }`}
                      >
                        {formatHours(alloc?.remaining ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <Deadline
                          deadline={alloc?.deadline ?? null}
                          remaining={alloc?.remaining ?? 0}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <AllocateHoursForm
                          studentProfileId={profile.id}
                          mentorId={mentor.id}
                          currentHours={alloc?.allocated ?? 0}
                          currentDeadline={
                            alloc?.deadline
                              ? alloc.deadline.toISOString().slice(0, 10)
                              : null
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StudentCorrections
        studentProfileId={profile.id}
        programs={toProgramOptions(programs)}
        currentProgramId={profile.programId}
        currentCohortId={profile.cohortId}
        hasSessions={sessionCount > 0}
      />

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Allocation history
        </h2>
        {profile.allotmentChanges.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            No allocation changes yet.
          </p>
        ) : (
          <ul className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
            {profile.allotmentChanges.map((c) => (
              <li key={c.id} className="flex flex-wrap gap-x-2 px-4 py-3">
                <span className="tabular-nums text-gray-500">
                  {formatDate(c.createdAt)}
                </span>
                <span>
                  {c.changedBy.name ?? c.changedBy.email} set hours with{" "}
                  {c.mentor.name ?? c.mentor.email}:{" "}
                  <span className="tabular-nums">
                    {formatHours(c.oldHours)} → {formatHours(c.newHours)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
