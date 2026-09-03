import Link from "next/link";

import { CreateMentorForm } from "@/components/forms/create-mentor-form";
import { MentorList, type MentorListRow } from "@/components/forms/mentor-list";
import {
  PAGE_SIZE,
  Pagination,
  parsePage,
} from "@/components/ui/pagination";
import { SearchForm } from "@/components/ui/search-form";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { programOptions, toProgramOptions } from "@/lib/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

/** How many unregistered sign-ins to name before the list is just a count. */
const UNASSIGNED_SHOWN = 10;

export default async function AdminMentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { q = "", page: rawPage } = await searchParams;
  const query = q.trim();
  const page = parsePage(rawPage);

  // Plain mentors plus dual-role admins who also mentor.
  const isMentor = { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] };
  const where = query
    ? {
        AND: [
          isMentor,
          { OR: [{ name: { contains: query } }, { email: { contains: query } }] },
        ],
      }
    : isMentor;

  const [mentors, total, unassigned, unassignedCount, programs] =
    await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.user.count({ where }),
      // Its own query rather than a filter over the page: someone waiting to be
      // registered must not be invisible because they sort onto page three.
      prisma.user.findMany({
        where: { AND: [isMentor, { status: USER_STATUS.UNASSIGNED }] },
        orderBy: { createdAt: "asc" },
        take: UNASSIGNED_SHOWN,
      }),
      prisma.user.count({
        where: { AND: [isMentor, { status: USER_STATUS.UNASSIGNED }] },
      }),
      programOptions(),
    ]);

  // Only the pairings of the mentors actually on this page.
  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId: { in: mentors.map((m) => m.id) } },
    include: { program: true, cohort: true },
    orderBy: { createdAt: "asc" },
  });

  const programSelectOptions = toProgramOptions(programs);
  const programsWithCohorts = new Set(
    programs.filter((p) => p.cohorts.length > 0).map((p) => p.id)
  );
  const rows: MentorListRow[] = mentors.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    status: m.status,
    isAdmin: m.role === ROLES.ADMIN,
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
      <h1 className="text-2xl font-bold text-ink">Mentors</h1>

      {unassignedCount > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent-soft p-4">
          <h2 className="text-base font-semibold text-ink">
            Awaiting assignment ({unassignedCount})
          </h2>
          <p className="mt-1 text-xs text-muted-fg">
            These mentors signed in before being registered. Edit one below to
            assign them to a program and activate them.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {unassigned.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/admin/mentors/${m.id}`}
                  className="font-medium hover:text-brand"
                >
                  {m.name ?? m.email}
                </Link>{" "}
                <span className="text-muted-fg">({m.email})</span> · signed up{" "}
                {formatDate(m.createdAt)}
              </li>
            ))}
          </ul>
          {unassignedCount > unassigned.length && (
            <p className="mt-1.5 text-xs text-muted-fg">
              …and {unassignedCount - unassigned.length} more — search for them
              below.
            </p>
          )}
        </div>
      )}

      <CreateMentorForm programs={programSelectOptions} />

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-ink">All mentors</h2>
        <SearchForm
          action="/admin/mentors"
          label="Find a mentor"
          placeholder="Name or email"
          defaultValue={query}
        />
        {rows.length === 0 ? (
          query ? (
            <EmptyState variant="no-results" title={`No mentor matches “${query}”`}>
              Check the spelling, or clear the search to see everyone.
            </EmptyState>
          ) : (
            <EmptyState title="No mentors registered">
              Staff on the mentor domain are added on their first sign-in.
            </EmptyState>
          )
        ) : (
          <>
            <MentorList mentors={rows} programs={programSelectOptions} />
            <Pagination
              basePath="/admin/mentors"
              params={{ q: query }}
              page={page}
              total={total}
              unit="mentors"
            />
          </>
        )}
      </div>
    </div>
  );
}
