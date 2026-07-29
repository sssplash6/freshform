import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/chip";
import { AddStudentsForm } from "@/components/forms/add-students-form";
import { CreateCohortForm } from "@/components/forms/program-forms";
import { MeetingsLog } from "@/components/meetings-log";
import { PersonChip } from "@/components/person-chip";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StudentsTable } from "@/components/students-table";
import { SectionHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { MASTERS_PROGRAM_NAME } from "../../../../../config/app-config";
import { formatHours, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { monogramOf, programTone } from "@/lib/person-tone";
import { recentMeetings, studentsWithHours, toProgramOptions } from "@/lib/queries";

/**
 * One program's whole world on a single page: vitals, cohorts, the meetings its
 * mentors logged, its students (with the add-by-email form under the list), and
 * its mentors. This is what a dashboard island expands into.
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

  const [students, assignments, recentSessions, position] = await Promise.all([
    studentsWithHours({ programId: program.id }),
    prisma.mentorAssignment.findMany({
      where: { programId: program.id },
      include: { mentor: true, cohort: true },
      orderBy: { createdAt: "asc" },
    }),
    recentMeetings({ programId: program.id, take: 12 }),
    // Position in creation order picks this program's hue (see programTone).
    // Program has no createdAt; cuids are timestamp-prefixed, so id order is
    // creation order, and this must match the ranking on the dashboard.
    prisma.program.count({ where: { id: { lt: program.id } } }),
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
        <PageHeader
          backHref="/admin"
          backLabel="Dashboard"
          eyebrow="Program"
          programTone={programTone(position)}
          monogram={monogramOf(program.name)}
          title={program.name}
          subtitle={`${students.length} student${students.length === 1 ? "" : "s"} · ${mentorCount} mentor${mentorCount === 1 ? "" : "s"} · ${formatHours(totals.remaining)} hours still to deliver.`}
        />
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

      <MeetingsLog
        sessions={recentSessions}
        title="Latest meetings"
        eyebrow={`Logged by mentors · ${program.name}`}
        emptyBody={`No sessions logged in ${program.name} yet.`}
      />

      <Panel tone="total">
        <PanelHeader
          tone="total"
          eyebrow="Enrolled"
          title="Students"
          caption={`${formatHours(totals.completed)} of ${formatHours(totals.allotted)} hours completed`}
        />
        <StudentsTable
          students={students}
          showProgram={false}
          showCohort={program.cohorts.length > 0}
          manageBase="/admin/students"
          framed={false}
        />
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <AddStudentsForm program={programOption} />
        </div>
      </Panel>

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
                <div className="flex flex-wrap items-center gap-2">
                  <PersonChip person={a.mentor} size="sm" />
                  {a.cohort && (
                    <span className="text-xs text-muted-fg">{a.cohort.name}</span>
                  )}
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

    </div>
  );
}
