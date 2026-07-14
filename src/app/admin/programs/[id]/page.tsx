import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/chip";
import { AddStudentsForm } from "@/components/forms/add-students-form";
import { CreateCohortForm } from "@/components/forms/program-forms";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
import { ArrowLeftIcon } from "@/components/icons";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { SESSION_STATUS } from "@/lib/constants";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { studentsWithHours, toProgramOptions } from "@/lib/queries";

/**
 * One program's whole world on a single page: vitals, cohorts, its students
 * (with the add-by-email form), its mentors, and the latest sessions. This
 * is what a dashboard island expands into.
 */
export default async function AdminProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await prisma.program.findUnique({
    where: { id },
    include: { cohorts: { orderBy: { name: "asc" } } },
  });
  if (!program) notFound();

  const [students, assignments, recentSessions] = await Promise.all([
    studentsWithHours({ programId: program.id }),
    prisma.mentorAssignment.findMany({
      where: { programId: program.id },
      include: { mentor: true, cohort: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.session.findMany({
      where: { student: { programId: program.id } },
      include: { student: { include: { user: true } }, mentor: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 20,
    }),
  ]);

  const totals = students.reduce(
    (acc, s) => ({
      allotted: acc.allotted + s.allottedHours,
      completed: acc.completed + s.completedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, remaining: 0 }
  );
  const mentorCount = new Set(assignments.map((a) => a.mentorId)).size;
  const programOption = toProgramOptions([program])[0];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy">
          {program.name}
        </h1>
        {program.cohorts.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {program.cohorts.map((c) => (
              <Chip key={c.id} tone="gray">
                {c.name}
              </Chip>
            ))}
          </div>
        )}
        <div className="mt-3">
          <CreateCohortForm programId={program.id} />
        </div>
      </div>

      <StatCardGrid>
        <StatCard label="Students" value={String(students.length)} />
        <StatCard label="Mentors" value={String(mentorCount)} />
        <StatCard
          label="Hours completed"
          value={formatHours(totals.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(totals.remaining)}
          tone={totals.remaining < 0 ? "danger" : "default"}
        />
      </StatCardGrid>

      <section className="rounded-lg border border-mist bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist px-4 py-3">
          <h2 className="text-base font-semibold text-navy">Students</h2>
          <p className="text-xs text-gray-500">
            {formatHours(totals.completed)} of {formatHours(totals.allotted)}{" "}
            hours completed
          </p>
        </div>
        <div className="border-b border-mist px-4 py-3">
          <AddStudentsForm program={programOption} />
        </div>
        <StudentsTable
          students={students}
          showProgram={false}
          showCohort={program.cohorts.length > 0}
          manageBase="/admin/students"
          framed={false}
        />
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-navy">Mentors</h2>
          <Link
            href="/admin/mentors"
            className="text-sm font-medium text-navy hover:text-brand-deep"
          >
            Register or assign mentors →
          </Link>
        </div>
        {assignments.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
            No mentors assigned to {program.name} yet.
          </p>
        ) : (
          <ul className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-gray-900">
                    {a.mentor.name ?? a.mentor.email}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {a.mentor.email}
                    {a.cohort ? ` · ${a.cohort.name}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {a.calendlyUrl ? (
                    <Chip tone="green">Booking link set</Chip>
                  ) : (
                    <Chip tone="gray">No booking link yet</Chip>
                  )}
                  <RemoveAssignmentButton assignmentId={a.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Latest sessions
        </h2>
        {recentSessions.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
            No sessions logged in {program.name} yet.
          </p>
        ) : (
          <ul className="divide-y divide-mist/60 rounded-lg border border-mist bg-white text-sm">
            {recentSessions.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-2 px-4 py-3">
                <span className="tabular-nums text-gray-500">
                  {formatDate(s.date)}
                </span>
                <span
                  className={
                    s.status === SESSION_STATUS.VOIDED
                      ? "text-gray-400 line-through"
                      : ""
                  }
                >
                  {s.mentor.name ?? s.mentor.email} ·{" "}
                  {s.student.user.name ?? s.student.user.email} ·{" "}
                  <span className="tabular-nums">{formatHours(s.hours)}h</span>
                  {s.task ? ` · ${s.task}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
