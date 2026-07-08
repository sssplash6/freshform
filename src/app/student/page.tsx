import { redirect } from "next/navigation";

import { ArrowLink } from "@/components/arrow-link";
import { Chip } from "@/components/chip";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { ROLES, SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { allocationSummary } from "@/lib/hours";
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

  // Self-signed-up student who hasn't picked a cohort yet.
  if (!profile) redirect("/student/onboarding");

  // Registered but not yet approved by an admin.
  if (user.status === USER_STATUS.PENDING) {
    return (
      <div className="rounded-lg border border-brand/40 bg-brand/5 p-6">
        <h1 className="text-3xl font-bold tracking-tight text-navy">
          Registration received
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          You&apos;re registered for {profile.cohort.program.name} /{" "}
          {profile.cohort.name}. An admin is reviewing your registration.
          Once approved, your mentoring hours will be allocated and appear
          here.
        </p>
      </div>
    );
  }

  const hours = await allocationSummary(profile.id);
  const activeSessions = profile.sessions.filter(
    (s) => s.status === SESSION_STATUS.ACTIVE
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy">My hours</h1>
        <p className="mt-1.5 text-base text-gray-500">
          {profile.cohort.program.name} / {profile.cohort.name}
        </p>
      </div>

      <StatCardGrid>
        <StatCard label="Hours allotted" value={formatHours(hours.allotted)} />
        <StatCard
          label="Hours completed"
          value={formatHours(hours.completed)}
          tone="brand"
        />
        <StatCard
          label="Hours remaining"
          value={formatHours(hours.remaining)}
          tone={hours.remaining < 0 ? "danger" : "default"}
        />
        <StatCard label="Sessions" value={String(activeSessions.length)} />
      </StatCardGrid>

      {hours.remaining < 0 && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          You&apos;ve used {formatHours(-hours.remaining)} hours more than your
          allotment. Talk to your program contact about topping up.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Hours with each mentor
        </h2>
        {hours.perMentor.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            No mentor hours allocated yet. An admin will set them up soon.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Mentor</th>
                  <th className="px-4 py-3 text-right">Allotted</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {hours.perMentor.map((m) => (
                  <tr
                    key={m.mentor.id}
                    className="transition-colors hover:bg-mist/20"
                  >
                    <td className="px-4 py-3">
                      {m.mentor.name ?? m.mentor.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatHours(m.allocated)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatHours(m.completed)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        m.remaining < 0 ? "text-red-600" : "text-navy"
                      }`}
                    >
                      {formatHours(m.remaining)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/40 bg-brand/5 p-5 text-[15px]">
        <span>Ready for your next session?</span>
        <ArrowLink href="/student/book">Book with one of your mentors</ArrowLink>
      </div>

      {hours.completed > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-mist bg-white p-5 text-[15px] text-gray-600">
          <span>How was your last session?</span>
          <ArrowLink href="/student/feedback">Rate your mentor</ArrowLink>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Session history
        </h2>
        {profile.sessions.length === 0 ? (
          <p className="rounded-lg border border-mist bg-white p-8 text-[15px] text-gray-500">
            No sessions yet. Book your first one!
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-mist bg-mist/40 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mentor</th>
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist/60">
                {profile.sessions.map((s) => {
                  const voided = s.status === SESSION_STATUS.VOIDED;
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors hover:bg-mist/20 ${voided ? "opacity-50" : ""}`}
                    >
                      <td className="px-4 py-3 tabular-nums">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-4 py-3">
                        {s.mentor.name ?? s.mentor.email}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatHours(s.hours)}
                      </td>
                      <td className="max-w-56 truncate px-4 py-3 text-gray-600">
                        {s.note ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {voided ? (
                          <Chip tone="gray">Voided, hours returned</Chip>
                        ) : (
                          <Chip tone="green">Completed</Chip>
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
