import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonChip } from "@/components/person-chip";
import { CreateCohortForm } from "@/components/forms/program-forms";
import {
  AssignMentorForm,
  DeleteCohortButton,
  DeleteProgramButton,
  RemoveStudentButton,
  RenameProgramForm,
} from "@/components/forms/program-settings-forms";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { ROLES } from "@/lib/constants";
import { MASTERS_PROGRAM_NAME } from "../../../../../../config/app-config";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { StatusChip } from "@/components/ui/status-chip";

/**
 * How the program is set up: its name, its cohorts, who teaches in it, and the
 * two ways things leave it — a student removed before any session was logged,
 * and the program itself once it is empty.
 *
 * Everything destructive confirms inline and says why it can't happen when it
 * can't, rather than failing after the click.
 */
export default async function AdminProgramSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;
  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      cohorts: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { students: true, mentorAssignments: true } },
        },
      },
      _count: { select: { staff: true } },
    },
  });
  if (!program) notFound();

  const [students, pairings, allMentors] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { programId: program.id },
      include: {
        user: true,
        cohort: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentorAssignment.findMany({
      where: { programId: program.id },
      include: { mentor: true, cohort: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const paired = new Set(pairings.map((p) => p.mentorId));
  const eligibleMentors = allMentors
    .filter((m) => !paired.has(m.id))
    .map((m) => ({ value: m.id, label: m.name ?? m.email }));
  const cohortOptions = program.cohorts.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const blockedReason =
    students.length > 0
      ? `${program.name} still has ${students.length} student${students.length === 1 ? "" : "s"}. Remove or move them before the program can go.`
      : program._count.staff > 0
        ? "A staff member is scoped to this program. Re-scope them in config/app-config.ts and re-seed first."
        : undefined;

  return (
    <div className="space-y-8">
      <Section
          eyebrow="Identity"
          title="Name"
          caption={
            program.name === MASTERS_PROGRAM_NAME
              ? "Billing rules match on this name — renaming it turns them off"
              : "Shown everywhere this program appears"
          }
      >
        <div className="px-4 py-4 sm:px-5">
          <RenameProgramForm programId={program.id} currentName={program.name} />
        </div>
      </Section>

      <Section
          eyebrow="Structure"
          title="Cohorts"
          caption={
            program.cohorts.length === 0
              ? "Flat program — students belong to it directly"
              : `${program.cohorts.length} cohort${program.cohorts.length === 1 ? "" : "s"}`
          }
      >
        {program.cohorts.length > 0 && (
          <ul className="divide-y divide-line/60 text-sm">
            {program.cohorts.map((c) => {
              const inUse =
                c._count.students > 0 || c._count.mentorAssignments > 0;
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div>
                    <div className="font-medium text-ink">{c.name}</div>
                    <div className="text-xs text-muted-fg">
                      {c._count.students} student
                      {c._count.students === 1 ? "" : "s"} ·{" "}
                      {c._count.mentorAssignments} mentor
                      {c._count.mentorAssignments === 1 ? "" : "s"}
                    </div>
                  </div>
                  {inUse ? (
                    <span className="text-xs text-muted-fg">
                      Not empty — move its people first
                    </span>
                  ) : (
                    <DeleteCohortButton cohortId={c.id} cohortName={c.name} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold text-ink">Add a cohort</h3>
          <p className="mb-2.5 mt-1 text-xs text-muted-fg">
            Programs are flat by default. The first cohort switches NEW
            enrollments to cohort-based; people already in the program stay put.
          </p>
          <CreateCohortForm programId={program.id} />
        </div>
      </Section>

      <Section
          eyebrow="People"
          title="Mentors"
          action={
            <Link
              href="/admin/mentors"
              className="text-sm font-medium text-ink hover:text-accent-ink"
            >
              Register a new mentor →
            </Link>
          }
      >
        {pairings.length === 0 ? (
          <EmptyState framed={false} title="No mentors assigned">
            Assign one below, or allocate a student time from any mentor and
            they join this program automatically.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
            {pairings.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PersonChip
                    person={p.mentor}
                    size="sm"
                    href={`/admin/mentors/${p.mentor.id}`}
                  />
                  {p.cohort && (
                    <span className="text-xs text-muted-fg">{p.cohort.name}</span>
                  )}
                  {p.calendlyUrl ? (
                    <StatusChip severity="ok">Booking link set</StatusChip>
                  ) : (
                    <StatusChip severity="attention">No booking link</StatusChip>
                  )}
                </div>
                <RemoveAssignmentButton assignmentId={p.id} />
              </li>
            ))}
          </ul>
        )}
        {eligibleMentors.length > 0 && (
          <div className="border-t border-line px-4 py-4 sm:px-5">
            <AssignMentorForm
              programId={program.id}
              mentors={eligibleMentors}
              cohorts={cohortOptions}
            />
          </div>
        )}
      </Section>

      <Section
          eyebrow="People"
          title="Enrolled students"
          caption="Removing a student deletes their account, enrollment and allocations"
      >
        {students.length === 0 ? (
          <EmptyState framed={false} title="Nobody enrolled">
            Register students on the Students tab.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
            {students.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <div>
                  <Link
                    href={`/admin/students/${s.id}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {s.user.name ?? s.user.email}
                  </Link>
                  <div className="text-xs text-muted-fg">
                    {s.user.email}
                    {s.cohort ? ` · ${s.cohort.name}` : ""} · {s._count.sessions}{" "}
                    session{s._count.sessions === 1 ? "" : "s"} logged
                  </div>
                </div>
                <RemoveStudentButton
                  studentProfileId={s.id}
                  label={s.user.name ?? s.user.email}
                  hasSessions={s._count.sessions > 0}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
          eyebrow="Danger zone"
          title="Close this program"
          caption="Only possible once nothing is left in it"
      >
        <div className="px-4 py-4 sm:px-5">
          <DeleteProgramButton
            programId={program.id}
            programName={program.name}
            blockedReason={blockedReason}
          />
        </div>
      </Section>
    </div>
  );
}
