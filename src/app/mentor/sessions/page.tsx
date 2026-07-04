import { SessionRowActions } from "@/components/forms/session-row-actions";
import { ROLES, SESSION_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function MentorSessionsPage() {
  const user = await requireRole(ROLES.MENTOR);

  const sessions = await prisma.session.findMany({
    where: { mentorId: user.id },
    include: { student: { include: { user: true, cohort: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const totalActiveHours = sessions
    .filter((s) => s.status === SESSION_STATUS.ACTIVE)
    .reduce((sum, s) => sum + s.hours, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy">My sessions</h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatHours(totalActiveHours)} active hours logged across{" "}
          {sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE).length}{" "}
          sessions.
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
          No sessions logged yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {sessions.map((s) => {
                const voided = s.status === SESSION_STATUS.VOIDED;
                return (
                  <tr key={s.id} className={voided ? "opacity-50" : ""}>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(s.date)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {s.student.user.name ?? s.student.user.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.student.cohort.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatHours(s.hours)}
                    </td>
                    <td className="max-w-56 truncate px-3 py-2 text-gray-600">
                      {s.note ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {voided ? (
                        <span className="rounded bg-mist px-1.5 py-0.5 text-xs text-gray-600">
                          Voided
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!voided && (
                        <SessionRowActions
                          session={{
                            id: s.id,
                            hours: s.hours,
                            date: formatDate(s.date),
                            note: s.note,
                          }}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
