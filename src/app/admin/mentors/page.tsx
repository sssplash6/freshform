import { AssignMentorForm } from "@/components/forms/assign-mentor-form";
import { CreateMentorForm } from "@/components/forms/create-mentor-form";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
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
      include: {
        mentor: true,
        program: true,
        cohort: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const unassigned = mentors.filter(
    (m) => m.status === USER_STATUS.UNASSIGNED
  );
  const programSelectOptions = toProgramOptions(programs);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-navy">Mentors</h1>

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-4">
          <h2 className="text-base font-semibold text-navy">
            Awaiting assignment ({unassigned.length})
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            These mentors signed in before being registered. Assign them to a
            program below to activate them.
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

      {mentors.length > 0 && (
        <AssignMentorForm
          mentors={mentors.map((m) => ({
            id: m.id,
            label: `${m.name ?? m.email}${
              m.status === USER_STATUS.UNASSIGNED ? " (unassigned)" : ""
            }`,
          }))}
          programs={programSelectOptions}
        />
      )}

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-navy">
          Current assignments
        </h2>
        {assignments.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            No assignments yet.
          </p>
        ) : (
          programs.map((program) => {
            const programAssignments = assignments.filter(
              (a) => a.programId === program.id
            );
            if (programAssignments.length === 0) return null;
            return (
              <section
                key={program.id}
                className="rounded-lg border border-mist bg-white"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-mist px-4 py-3">
                  <h3 className="text-base font-semibold text-navy">
                    {program.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {programAssignments.length} mentor
                    {programAssignments.length === 1 ? "" : "s"} assigned
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Mentor</th>
                        {program.cohorts.length > 0 && (
                          <th className="px-4 py-3">Scope</th>
                        )}
                        <th className="px-4 py-3">Booking link</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mist/60">
                      {programAssignments.map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {a.mentor.name ?? "—"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {a.mentor.email}
                            </div>
                          </td>
                          {program.cohorts.length > 0 && (
                            <td className="px-4 py-3">
                              {a.cohort ? a.cohort.name : "All cohorts"}
                            </td>
                          )}
                          <td className="max-w-64 truncate px-4 py-3">
                            {a.calendlyUrl ? (
                              <a
                                href={a.calendlyUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-navy underline decoration-mist underline-offset-2 hover:decoration-navy"
                              >
                                {a.calendlyUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400">
                                Not set by the mentor yet
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <RemoveAssignmentButton assignmentId={a.id} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
