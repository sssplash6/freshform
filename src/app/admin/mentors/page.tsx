import { AssignMentorForm } from "@/components/forms/assign-mentor-form";
import { RemoveAssignmentButton } from "@/components/forms/remove-assignment-button";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { cohortOptions } from "@/lib/queries";

export default async function AdminMentorsPage() {
  const [mentors, cohorts, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.MENTOR },
      orderBy: { createdAt: "asc" },
    }),
    cohortOptions(),
    prisma.mentorAssignment.findMany({
      include: {
        mentor: true,
        cohort: { include: { program: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const unassigned = mentors.filter(
    (m) => m.status === USER_STATUS.UNASSIGNED
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-navy">Mentors</h1>

      {unassigned.length > 0 && (
        <div className="rounded-lg border border-brand/40 bg-brand/5 p-4">
          <h2 className="text-sm font-semibold text-navy">
            Awaiting assignment ({unassigned.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {unassigned.map((m) => (
              <li key={m.id}>
                {m.name ?? "—"}{" "}
                <span className="text-gray-500">({m.email})</span> — signed up{" "}
                {m.createdAt.toISOString().slice(0, 10)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mentors.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          No mentors yet. Mentors self-register by signing in with their
          @freshman.academy Google account.
        </p>
      ) : (
        <AssignMentorForm
          mentors={mentors.map((m) => ({
            id: m.id,
            label: `${m.name ?? m.email}${
              m.status === USER_STATUS.UNASSIGNED ? " (unassigned)" : ""
            }`,
          }))}
          cohorts={cohorts.map((c) => ({
            id: c.id,
            label: `${c.program.name} / ${c.name}`,
          }))}
        />
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-navy">
          Current assignments
        </h2>
        {assignments.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
            No assignments yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Mentor</th>
                  <th className="px-3 py-2">Program / Cohort</th>
                  <th className="px-3 py-2">Booking link</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {a.mentor.name ?? "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.mentor.email}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {a.cohort.program.name} / {a.cohort.name}
                    </td>
                    <td className="max-w-64 truncate px-3 py-2">
                      <a
                        href={a.calendlyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-navy underline decoration-mist underline-offset-2 hover:decoration-navy"
                      >
                        {a.calendlyUrl}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <RemoveAssignmentButton assignmentId={a.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
