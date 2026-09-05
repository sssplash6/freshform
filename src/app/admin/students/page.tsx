import { StudentsTable } from "@/components/students-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import { adminScope, scopeProgramFilter } from "@/lib/authz";
import { requireAdminAccess } from "@/lib/dal";
import {
  STUDENT_PRESETS,
  activeFilterCount,
  filterSummary,
  readParam,
  studentsWhere,
  type SearchParams,
} from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { studentsWithHours } from "@/lib/queries";

/**
 * Every student across programs in one table: found by name or email, narrowed
 * by program and by the five states worth a chip.
 *
 * Every narrowing happens in the query. The program filter used to be a JS
 * `.filter()` over every student in the school, which meant the cost of showing
 * one program was the cost of loading all of them — and the search box, the
 * program select and the page number each read the URL their own way, so
 * searching lost the program.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdminAccess();
  const programIds = scopeProgramFilter(await adminScope(user));
  const params = await searchParams;
  const page = parsePage(readParam(params, "page"));
  // One instant for the whole page: the "expiring" and "expired" chips and the
  // forfeiture the table shows have to be judged against the same clock, or a
  // student can be in the filtered list and unexpired in the row.
  const now = new Date();

  // The reader's grants, ANDed in before anything the URL says — so a program
  // id pasted from outside them narrows to nothing rather than widening the
  // read. `undefined` is a platform admin: every program.
  const where = studentsWhere(params, { programIds }, now);

  const [programs, students, total, anyCohorts] = await Promise.all([
    prisma.program.findMany({
      where: programIds ? { id: { in: [...programIds] } } : {},
      orderBy: { name: "asc" },
    }),
    studentsWithHours(where, { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }, now),
    prisma.studentProfile.count({ where }),
    // Whether the cohort column is worth its width at all, asked of the whole
    // table rather than of whichever students landed on this page.
    prisma.studentProfile.count({
      where: {
        cohortId: { not: null },
        ...(programIds ? { programId: { in: [...programIds] } } : {}),
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">Students</h1>

      <FilterBar
        basePath="/admin/students"
        params={params}
        q="students"
        selects={
          // One program is not a choice, and a select that offers exactly one
          // option is a fold, a tap and a line of height for nothing.
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
        presets={STUDENT_PRESETS}
        summary={filterSummary(total, { one: "student", many: "students" }, params)}
      />

      {total === 0 ? (
        // No title: the bar above has just said in words that nothing matches,
        // and saying it twice makes one fact read as two. What is left to add
        // is the way out.
        activeFilterCount(params) > 0 ? (
          <EmptyState variant="no-results">
            Check the spelling, or reset to see everyone.
          </EmptyState>
        ) : (
          <EmptyState title="No students registered">
            Staff register them; each then confirms their name on first sign-in.
          </EmptyState>
        )
      ) : (
        <>
          <StudentsTable
            students={students}
            showProgram
            showCohort={anyCohorts > 0}
            manageBase="/admin/students"
          />
          <Pagination
            basePath="/admin/students"
            params={params}
            page={page}
            total={total}
            unit="students"
          />
        </>
      )}
    </div>
  );
}
