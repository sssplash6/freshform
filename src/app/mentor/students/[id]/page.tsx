import Link from "next/link";
import { notFound } from "next/navigation";

import { Chip } from "@/components/chip";
import { ArrowLeftIcon } from "@/components/icons";
import { LogSessionForm } from "@/components/forms/log-session-form";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { SESSION_STATUS, USER_STATUS } from "@/lib/constants";
import { requireMentor } from "@/lib/dal";
import { formatDate, formatHours } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * Mentor's view of one of their students: hours the student holds with THIS
 * mentor, how to reach them (Telegram), and their shared session history.
 * Only reachable for students the mentor has an allocation or session with.
 */
export default async function MentorStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const mentor = await requireMentor();
  const { id } = await params;

  const profile = await prisma.studentProfile.findUnique({
    where: { id },
    include: { user: true, program: true, cohort: true },
  });
  if (!profile) notFound();

  const [allocation, sessions] = await Promise.all([
    prisma.hourAllocation.findUnique({
      where: {
        studentId_mentorId: { studentId: profile.id, mentorId: mentor.id },
      },
    }),
    prisma.session.findMany({
      where: { studentId: profile.id, mentorId: mentor.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // Not this mentor's student — nothing to see here.
  if (!allocation && sessions.length === 0) notFound();

  const allocated = allocation?.hours ?? 0;
  const completed = sessions
    .filter((s) => s.status === SESSION_STATUS.ACTIVE)
    .reduce((sum, s) => sum + s.hours, 0);
  const remaining = allocated - completed;
  const approved = profile.user.status === USER_STATUS.ACTIVE;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/mentor"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-navy"
        >
          <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          My students
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-navy">
            {profile.user.name ?? profile.user.email}
          </h1>
          {!approved && <Chip tone="amber">Pending approval</Chip>}
        </div>
        <p className="mt-1.5 text-base text-gray-500">
          {profile.user.email} · {profile.program.name}
          {profile.cohort ? ` / ${profile.cohort.name}` : ""}
          {profile.telegramUsername ? (
            <>
              {" · Telegram "}
              <a
                href={`https://t.me/${profile.telegramUsername}`}
                target="_blank"
                rel="noreferrer"
                className="text-navy underline decoration-mist underline-offset-2 hover:decoration-navy"
              >
                @{profile.telegramUsername}
              </a>
            </>
          ) : (
            " · Telegram not set yet"
          )}
        </p>
      </div>

      <StatCardGrid>
        <StatCard label="Allocated to you" value={formatHours(allocated)} />
        <StatCard
          label="Completed with you"
          value={formatHours(completed)}
          tone="brand"
        />
        <StatCard
          label="Remaining with you"
          value={formatHours(remaining)}
          tone={remaining < 0 ? "danger" : "default"}
        />
        <StatCard
          label="Sessions together"
          value={String(
            sessions.filter((s) => s.status === SESSION_STATUS.ACTIVE).length
          )}
        />
      </StatCardGrid>

      {approved ? (
        <LogSessionForm
          students={[
            {
              profileId: profile.id,
              label: `${profile.user.name ?? profile.user.email} · ${formatHours(remaining)}h left with you`,
            },
          ]}
        />
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          This student is still awaiting admin approval — sessions can be
          logged once they&apos;re approved.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-base font-semibold text-navy">
          Your sessions with {profile.user.name?.split(" ")[0] ?? "them"}
        </h2>
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
                  <th className="px-4 py-3 text-right">Hours</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3">Status</th>
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
