import { CreateMentorForm } from "@/components/forms/create-mentor-form";
import { MentorList, type MentorListRow } from "@/components/forms/mentor-list";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { programOptions, toProgramOptions } from "@/lib/queries";

export default async function AdminMentorsPage() {
  const [mentors, programs, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.MENTOR },
      orderBy: { createdAt: "asc" },
    }),
    programOptions(),
    prisma.mentorAssignment.findMany({
      include: { program: true, cohort: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const unassigned = mentors.filter(
    (m) => m.status === USER_STATUS.UNASSIGNED
  );
  const programSelectOptions = toProgramOptions(programs);

  const programsWithCohorts = new Set(
    programs.filter((p) => p.cohorts.length > 0).map((p) => p.id)
  );
  const rows: MentorListRow[] = mentors.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    status: m.status,
    assignments: assignments
      .filter((a) => a.mentorId === m.id)
      .map((a) => ({
        id: a.id,
        checkedValue: a.cohortId ? `c:${a.cohortId}` : `p:${a.programId}`,
        label: a.cohort
          ? `${a.program.name} / ${a.cohort.name}`
          : programsWithCohorts.has(a.programId)
            ? `${a.program.name} (all cohorts)`
            : a.program.name,
        calendlyUrl: a.calendlyUrl,
      })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Mentors</h1>

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-4">
          <h2 className="text-base font-semibold text-navy">
            Awaiting assignment ({unassigned.length})
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            These mentors signed in before being registered. Edit one below to
            assign them to a program and activate them.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {unassigned.map((m) => (
              <li key={m.id}>
                {m.name ?? "—"}{" "}
                <span className="text-gray-500">({m.email})</span> · signed up{" "}
                {m.createdAt.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CreateMentorForm programs={programSelectOptions} />

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-navy">All mentors</h2>
        <MentorList mentors={rows} programs={programSelectOptions} />
      </div>
    </div>
  );
}
