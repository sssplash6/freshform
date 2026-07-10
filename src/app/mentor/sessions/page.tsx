import { Chip } from "@/components/chip";
import { SessionRowActions } from "@/components/forms/session-row-actions";
import { SESSION_STATUS } from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function MentorSessionsPage() {
  const user = await requireMentor();

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
        <h1 className="text-3xl font-bold tracking-tight text-navy">My sessions</h1>
        <p className="mt-1.5 text-base text-gray-500">
          {formatHours(totalActiveHours)} active hours logged across{" "}
          {sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE).length}{" "}
          sessions.
        </p>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
          No sessions logged yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-mist/60">
              {sessions.map((s) => {
                const voided = s.status === SESSION_STATUS.VOIDED;
                return (
                  <tr key={s.id} className={voided ? "opacity-50" : ""}>
                    <td className="px-4 py-3 tabular-nums">
                      {formatDate(s.date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {s.student.user.name ?? s.student.user.email}
                      </div>
                      <div className="text-xs text-gray-500">
                        {s.student.cohort.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatHours(s.hours)}
                    </td>
                    <td className="max-w-56 truncate px-4 py-3 text-gray-600">
                      {s.note ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {voided ? (
                        <Chip tone="gray">Voided</Chip>
                      ) : (
                        <Chip tone="green">Active</Chip>
                      )}
                    </td>
                    <td className="px-4 py-3">
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
