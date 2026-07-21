import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/chip";
import { AddStudentsForm } from "@/components/forms/add-students-form";
import { CreateCohortForm } from "@/components/forms/program-forms";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { Card, SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SESSION_STATUS } from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatDate, formatHours, formatMoney } from "@/lib/format";
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
      missed: acc.missed + s.missedHours,
      remaining: acc.remaining + s.remainingHours,
    }),
    { allotted: 0, completed: 0, missed: 0, remaining: 0 }
  );
  const mentorCount = new Set(assignments.map((a) => a.mentorId)).size;
  const programOption = toProgramOptions([program])[0];
  const isMasters = program.name === MASTERS_PROGRAM_NAME;
  const totalPaid = students.reduce((sum, s) => sum + s.amountPaid, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <PageHeader backHref="/admin" backLabel="Dashboard" title={program.name} />
        <div className="flex flex-wrap items-center gap-2">
          {program.cohorts.map((c) => (
            <Chip key={c.id} tone="gray">
              {c.name}
            </Chip>
          ))}
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
        {totals.missed > 0 && (
          <StatCard label="Hours missed" value={formatHours(totals.missed)} />
        )}
        <StatCard
          label="Hours remaining"
          value={formatHours(totals.remaining)}
          tone={totals.remaining < 0 ? "danger" : "default"}
        />
        {isMasters && (
          <StatCard label="Total paid" value={formatMoney(totalPaid)} />
        )}
      </StatCardGrid>

      <Card as="section">
        <SectionHeader
          className="border-b border-line px-4 py-3"
          title="Students"
          caption={`${formatHours(totals.completed)} of ${formatHours(totals.allotted)} hours completed`}
        />
        <div className="border-b border-line px-4 py-3">
          <AddStudentsForm program={programOption} />
        </div>
        <StudentsTable
          students={students}
          showProgram={false}
          showCohort={program.cohorts.length > 0}
          manageBase="/admin/students"
          framed={false}
        />
      </Card>

      <section>
        <SectionHeader
          className="mb-2"
          title="Mentors"
          action={
            <Link
              href="/admin/mentors"
              className="text-sm font-medium text-ink hover:text-accent-ink"
            >
              Register or assign mentors →
            </Link>
          }
        />
        {assignments.length === 0 ? (
          <EmptyState>No mentors assigned to {program.name} yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 rounded-xl border border-line bg-surface text-sm">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-ink">
                    {a.mentor.name ?? a.mentor.email}
                  </span>
                  <span className="ml-2 text-xs text-muted-fg">
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
        <h2 className="mb-2 text-base font-semibold text-ink">
          Latest sessions
        </h2>
        {recentSessions.length === 0 ? (
          <EmptyState>No sessions logged in {program.name} yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 rounded-xl border border-line bg-surface text-sm">
            {recentSessions.map((s) => (
              <li key={s.id} className="flex flex-wrap gap-x-2 px-4 py-3">
                <span className="tabular-nums text-muted-fg">
                  {formatDate(s.date)}
                </span>
                <span
                  className={
                    s.status === SESSION_STATUS.VOIDED
                      ? "text-muted-fg line-through"
                      : ""
                  }
                >
                  {s.mentor.name ?? s.mentor.email} ·{" "}
                  {s.student.user.name ?? s.student.user.email} ·{" "}
                  <span className="tabular-nums">{formatHours(s.hours)}h</span>
                  {s.task ? ` · ${s.task}` : ""}
                  {s.status !== SESSION_STATUS.VOIDED && !s.attended && (
                    <span className="ml-1 font-medium text-amber-700">
                      · no-show
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
