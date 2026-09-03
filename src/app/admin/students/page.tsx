import { Select } from "@/components/select";
import { StudentsTable } from "@/components/students-table";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/ui/pagination";
import { SearchForm } from "@/components/ui/search-form";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { studentsWithHours } from "@/lib/queries";

/**
 * Every student across programs in one table, searchable by name or email and
 * filterable by program. Rows link to the student's detail page (approval,
 * per-mentor allocations).
 *
 * Both narrowings happen in the query. The program filter used to be a JS
 * `.filter()` over every student in the school, which meant the cost of showing
 * one program was the cost of loading all of them.
 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; q?: string; page?: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { program = "", q = "", page: rawPage } = await searchParams;
  const query = q.trim();
  const page = parsePage(rawPage);

  const where = {
    ...(program ? { programId: program } : {}),
    ...(query
      ? {
          user: {
            OR: [{ name: { contains: query } }, { email: { contains: query } }],
          },
        }
      : {}),
  };

  const [programs, students, total, anyCohorts] = await Promise.all([
    prisma.program.findMany({ orderBy: { name: "asc" } }),
    studentsWithHours(where, {
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.studentProfile.count({ where }),
    // Whether the cohort column is worth its width at all, asked of the whole
    // table rather than of whichever students landed on this page.
    prisma.studentProfile.count({ where: { cohortId: { not: null } } }),
  ]);
  const programOptions = programs.map((p) => ({ value: p.id, label: p.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Students</h1>

      <SearchForm
        action="/admin/students"
        label="Find a student"
        placeholder="Name or email"
        defaultValue={query}
      >
        <label className="block text-sm">
          <span className="text-muted-fg">Program</span>
          <div className="mt-0.5 w-56">
            <Select
              name="program"
              ariaLabel="Filter by program"
              options={programOptions}
              placeholder="All programs"
              defaultValue={program}
              required={false}
            />
          </div>
        </label>
      </SearchForm>

      {total === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-8 text-[15px] text-muted-fg">
          {query
            ? `No student matches “${query}”.`
            : program
              ? "No students in this program yet."
              : "No students yet."}
        </p>
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
            params={{ program, q: query }}
            page={page}
            total={total}
            unit="students"
          />
        </>
      )}
    </div>
  );
}
