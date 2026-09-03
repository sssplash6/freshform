import { MentorFeedbackList } from "@/components/mentor-feedback-list";
import { Rating } from "@/components/rating";
import { Figure, FigureRow } from "@/components/ui/figure";
import { FilterBar } from "@/components/ui/filter-bar";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { ROLES } from "@/lib/constants";
import { requireRole } from "@/lib/dal";
import { mentorFeedbackGroups } from "@/lib/feedback";
import {
  DATE_PRESETS,
  activeFilterCount,
  feedbackWhere,
  filterSummary,
  readDateWindow,
  readParam,
  type SearchParams,
} from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/ui/empty-state";
import { ExpandableText } from "@/components/expandable-text";
import { formatDate } from "@/lib/format";

/** Mentors per page of the grouped list, and site comments per page. */
const MENTORS_PER_PAGE = 10;
const SITE_PER_PAGE = 20;

/**
 * "Rating at most N" — how a mentor who is being scored badly is found.
 *
 * Only 1 to 4: "5 or fewer" is every rating there is, so it would be a control
 * that reads as a filter and does nothing.
 */
const RATING_OPTIONS = [
  { value: "1", label: "1 star" },
  { value: "2", label: "2 stars or fewer" },
  { value: "3", label: "3 stars or fewer" },
  { value: "4", label: "4 stars or fewer" },
];

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole(ROLES.ADMIN);
  const params = await searchParams;
  const page = parsePage(readParam(params, "page"));
  const sitePage = parsePage(readParam(params, "site"));
  const now = new Date();

  // An admin sees every program; the scope is passed empty rather than left
  // out, because this is where a per-program grant lands (REDESIGN.md phase 3)
  // and reach must never be something the URL can argue about.
  const where = feedbackWhere(params, {}, now);
  const dateRange = readDateWindow(params, now);
  const filtered = activeFilterCount(params) > 0;

  // The headline numbers are aggregates, not a whole table read into memory to
  // be averaged in JavaScript. The mentor half reads through the same `where`
  // as the list under it: a filtered list beside an unfiltered average is two
  // answers to one question.
  const [mentorStats, siteStats, { groups, mentors }, websiteFeedback, rated, programs] =
    await Promise.all([
      prisma.mentorFeedback.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
      prisma.websiteFeedback.aggregate({ _avg: { rating: true }, _count: true }),
      mentorFeedbackGroups(where, {
        skip: (page - 1) * MENTORS_PER_PAGE,
        take: MENTORS_PER_PAGE,
      }),
      prisma.websiteFeedback.findMany({
        include: { student: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        skip: (sitePage - 1) * SITE_PER_PAGE,
        take: SITE_PER_PAGE,
      }),
      // Only mentors somebody has actually rated: a picker offering the other
      // forty is forty ways to reach an empty list.
      prisma.user.findMany({
        where: { mentorFeedback: { some: {} } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      prisma.program.findMany({ orderBy: { name: "asc" } }),
    ]);

  const mentorAvg = mentorStats._avg.rating;
  const siteAvg = siteStats._avg.rating;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Feedback</h1>

      <FigureRow>
        <Figure label="Mentor ratings" value={String(mentorStats._count)} />
        <Figure
          label="Avg mentor rating"
          value={mentorAvg === null ? "—" : mentorAvg.toFixed(1)}
        />
        <Figure label="Website ratings" value={String(siteStats._count)} />
        <Figure
          label="Avg website rating"
          value={siteAvg === null ? "—" : siteAvg.toFixed(1)}
        />
      </FigureRow>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Mentor feedback</h2>
        {/* The bar narrows the mentor half only. Website ratings carry no
            mentor, no program and no comment to search, so a filter that
            silently applied to them would be answering a question nobody
            asked. */}
        <FilterBar
          basePath="/admin/feedback"
          params={params}
          q="feedback"
          selects={[
            {
              name: "mentor",
              label: "Mentor",
              all: "All mentors",
              options: rated.map((m) => ({
                value: m.id,
                label: m.name ?? m.email,
                hint: m.name ? m.email : undefined,
              })),
            },
            {
              name: "program",
              label: "Program",
              all: "All programs",
              options: programs.map((p) => ({ value: p.id, label: p.name })),
            },
            {
              name: "rating",
              label: "Rating",
              all: "Any rating",
              options: RATING_OPTIONS,
            },
          ]}
          presets={DATE_PRESETS}
          dateRange={dateRange}
          // Only once a filter is on. Unfiltered, the sentence would be the
          // "Mentor ratings" figure a few pixels above it in different words;
          // filtered, it is the one thing that figure cannot say — that the
          // number is a subset and here is how to undo it.
          summary={
            filtered
              ? filterSummary(
                  mentorStats._count,
                  { one: "rating", many: "ratings" },
                  params
                )
              : undefined
          }
        />
        {mentors === 0 ? (
          filtered ? (
            <EmptyState variant="no-results">
              Widen the window, or reset to read every rating.
            </EmptyState>
          ) : (
            <EmptyState title="No mentor ratings">
              A student rates a mentor from their own feedback page.
            </EmptyState>
          )
        ) : (
          <>
            <MentorFeedbackList groups={groups} mentorBase="/admin/mentors" />
            <Pagination
              basePath="/admin/feedback"
              params={params}
              page={page}
              pageSize={MENTORS_PER_PAGE}
              total={mentors}
              unit="rated mentors"
            />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">Website feedback</h2>
        {websiteFeedback.length === 0 ? (
          <EmptyState title="No website feedback">
            Students leave this from their own feedback page; most never do.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {websiteFeedback.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Rating value={f.rating} />
                  <span className="text-xs text-muted-fg">
                    by {f.student.user.name ?? f.student.user.email} ·{" "}
                    {formatDate(f.createdAt)}
                  </span>
                </div>
                {f.comment && (
                  <div className="mt-0.5">
                    <ExpandableText text={f.comment} className="text-muted-fg" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination
          basePath="/admin/feedback"
          params={params}
          page={sitePage}
          pageSize={SITE_PER_PAGE}
          total={siteStats._count}
          unit="website ratings"
          param="site"
        />
      </section>
    </div>
  );
}
