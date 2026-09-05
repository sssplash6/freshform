import Link from "next/link";

import { CreateMentorForm } from "@/components/forms/create-mentor-form";
import { MentorList, type MentorListRow } from "@/components/forms/mentor-list";
import { FilterBar } from "@/components/ui/filter-bar";
import {
  PAGE_SIZE,
  Pagination,
  parsePage,
} from "@/components/ui/pagination";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { adminScope, scopeProgramFilter } from "@/lib/authz";
import { requireAdminAccess } from "@/lib/dal";
import {
  MENTOR_PRESETS,
  activeFilterCount,
  filterSummary,
  mentorsWhere,
  readParam,
  type SearchParams,
} from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { programOptions, toProgramOptions } from "@/lib/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

/** How many unregistered sign-ins to name before the list is just a count. */
const UNASSIGNED_SHOWN = 10;

export default async function AdminMentorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdminAccess();
  const programIds = scopeProgramFilter(await adminScope(user));
  const params = await searchParams;
  const page = parsePage(readParam(params, "page"));

  // Plain mentors plus dual-role admins who also mentor. `mentorsWhere` states
  // that rule once and adds the program, the two chips and the search on top.
  const isMentor = { OR: [{ role: ROLES.MENTOR }, { isMentor: true }] };
  const where = mentorsWhere(params, { programIds });

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
      programOptions(programIds),
    ]);

  // Only the pairings of the mentors actually on this page — and only the ones
  // in programs the reader administers. A mentor may work in three programs
  // and be this reader's colleague in one; the other two are not theirs to
  // read, and the row would otherwise name them and show their booking links.
  const assignments = await prisma.mentorAssignment.findMany({
    where: {
      mentorId: { in: mentors.map((m) => m.id) },
      ...(programIds ? { programId: { in: [...programIds] } } : {}),
    },
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
        <FilterBar
          basePath="/admin/mentors"
          params={params}
          q="mentors"
          selects={
            // One program is not a choice.
            programs.length > 1
              ? [
                  {
                    name: "program",
                    label: "Program",
                    all: "All programs",
                    options: programs.map((p) => ({ value: p.id, label: p.name })),
                  },
                ]
              : []
          }
          presets={MENTOR_PRESETS}
          summary={filterSummary(total, { one: "mentor", many: "mentors" }, params)}
        />
        {rows.length === 0 ? (
          // The bar has already said in words that nothing matched, so the
          // state below it adds the way out and not the count again.
          activeFilterCount(params) > 0 ? (
            <EmptyState variant="no-results">
              Check the spelling, or reset to see everyone.
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
              params={params}
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
