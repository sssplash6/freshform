import { PersonCell } from "@/components/person-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, Td, Tr, type Column } from "@/components/ui/table";
import { mentorStatuses, type ViewerContext } from "@/lib/status";

/**
 * The mentor roster, in four columns.
 *
 * What it replaces was a list of cards, and the cards were the problem. Each
 * one carried the mentor, one chip per pairing, a bare "link" / "no link"
 * anchor beside every chip, and an Edit button that unfolded a whole form —
 * name, email and a program picker — inside the row. Twenty-five of those is
 * twenty-five pickers built over the same program list, and a page whose
 * height depends on how many programs the busiest mentor works in.
 *
 * So the row says the four things a roster is scanned for — who, where, can a
 * student book them, and are they holding anybody's time — and everything you
 * might DO to a mentor happens on that mentor's page.
 *
 * "Booking links" is a fraction rather than a chip per pairing because the
 * question here is whether this mentor is bookable at all; WHICH program is
 * missing its link is a fact about one mentor, and it is on their page beside
 * the form that fixes it.
 */
export type MentorRow = {
  id: string;
  name: string | null;
  email: string;
  avatarUpdatedAt?: Date | null;
  /** `USER_STATUS`. */
  accountStatus: string;
  /** A dual-role admin who also mentors. */
  isAdmin: boolean;
  /** Program (or program / cohort) labels, already narrowed to the reader. */
  programs: string[];
  pairings: number;
  pairingsWithLink: number;
  /** Students holding time from this mentor, inside the reader's programs. */
  students: number;
  averageRating: number | null;
  ratingCount: number;
};

const COLUMNS: Column[] = [
  { label: "Mentor" },
  { label: "Programs" },
  { label: "Booking links" },
  { label: "Students", align: "right" },
];

export function MentorsTable({
  rows,
  viewer,
  href = "/mentors",
  framed = true,
  empty,
}: {
  rows: MentorRow[];
  /** Whose words the chips are in. */
  viewer: ViewerContext;
  /** Base path for a row's link. */
  href?: string;
  framed?: boolean;
  /** Pass an `EmptyState variant="no-results"` when a filter did the emptying. */
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) {
    return (
      empty ?? (
        <EmptyState framed={framed} title="No mentors registered">
          A mentor is registered by an admin, or arrives on their first sign-in.
        </EmptyState>
      )
    );
  }

  return (
    <Table columns={COLUMNS} framed={framed}>
      {rows.map((m, i) => {
        // One chip, the first thing the model has to say about them. A row
        // wearing three chips is a row nobody reads; the full list is on their
        // own page, under a heading that says what to do about each.
        const [top] = mentorStatuses(
          {
            id: m.id,
            name: m.name,
            email: m.email,
            accountStatus: m.accountStatus,
            programCount: m.pairings,
            pairingsMissingLink: m.pairings - m.pairingsWithLink,
            averageRating: m.averageRating,
            ratingCount: m.ratingCount,
          },
          viewer
        );

        return (
          <Tr
            key={m.id}
            className="deal-in"
            style={{ animationDelay: `${Math.min(i, 14) * 24}ms` }}
          >
            <Td>
              <PersonCell
                person={{
                  id: m.id,
                  name: m.name,
                  email: m.email,
                  avatarUpdatedAt: m.avatarUpdatedAt,
                }}
                href={`${href}/${m.id}`}
              >
                {/* Muted text, never a chip: "also an admin" is a fact about
                    the account, and a coloured pill beside a status chip reads
                    as a second state to act on. */}
                {m.isAdmin && (
                  <span className="shrink-0 text-xs font-normal text-muted-fg">
                    Admin
                  </span>
                )}
                {top && <StatusChip status={top} />}
              </PersonCell>
            </Td>

            <Td label="Programs" className="text-ink">
              {m.programs.length > 0 ? (
                m.programs.join(" · ")
              ) : (
                <span className="text-muted-fg">—</span>
              )}
            </Td>

            <Td label="Booking links">
              {m.pairings === 0 ? (
                <span className="text-muted-fg">—</span>
              ) : (
                <span
                  className={
                    m.pairingsWithLink < m.pairings
                      ? "text-warn-ink"
                      : "text-muted-fg"
                  }
                >
                  {m.pairingsWithLink} of {m.pairings} set
                </span>
              )}
            </Td>

            <Td label="Students" align="right" className="tabular-nums">
              {m.students > 0 ? (
                <span className="font-medium text-ink">{m.students}</span>
              ) : (
                <span className="text-muted-fg">—</span>
              )}
            </Td>
          </Tr>
        );
      })}
    </Table>
  );
}
