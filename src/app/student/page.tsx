import Link from "next/link";

import { StatCard, StatCardGrid } from "@/components/stat-card";
import { ROLES, SESSION_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function StudentHomePage() {
  const user = await requireRole(ROLES.STUDENT);

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    include: {
      cohort: { include: { program: true } },
      sessions: {
        include: { mentor: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!profile) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Your account isn&apos;t linked to a cohort. Ask your program contact to
        fix your registration.
      </p>
    );
  }

  const completed = profile.sessions
    .filter((s) => s.status === SESSION_STATUS.ACTIVE)
    .reduce((sum, s) => sum + s.hours, 0);
  const remaining = profile.allottedHours - completed;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-navy">My hours</h1>
        <p className="mt-1 text-sm text-gray-500">
          {profile.cohort.program.name} / {profile.cohort.name}
        </p>
      </div>

      <StatCardGrid>
        <StatCard
          label="Hours allotted"
          value={formatHours(profile.allottedHours)}
        />
        <StatCard
          label="Hours completed"
          value={formatHours(completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(remaining)}
          tone={remaining < 0 ? "danger" : "default"}
        />
        <StatCard
          label="Sessions"
          value={String(
            profile.sessions.filter(
              (s) => s.status === SESSION_STATUS.ACTIVE
            ).length
          )}
        />
      </StatCardGrid>

      {remaining < 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          You&apos;ve used {formatHours(-remaining)} hours more than your
          allotment. Talk to your program contact about topping up.
        </p>
      )}

      <div className="rounded-lg border border-brand/40 bg-brand/5 p-4 text-sm">
        Ready for your next session?{" "}
        <Link
          href="/student/book"
          className="font-medium text-navy underline underline-offset-2"
        >
          Book with one of your mentors →
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy">
          Session history
        </h2>
        {profile.sessions.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-6 text-sm text-gray-500">
            No sessions yet — book your first one!
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Mentor</th>
                  <th className="px-3 py-2 text-right">Hours</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {profile.sessions.map((s) => {
                  const voided = s.status === SESSION_STATUS.VOIDED;
                  return (
                    <tr key={s.id} className={voided ? "opacity-50" : ""}>
                      <td className="px-3 py-2 tabular-nums">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-3 py-2">
                        {s.mentor.name ?? s.mentor.email}
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
                            Voided — hours returned
                          </span>
                        ) : (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
