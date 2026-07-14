"use client";

import { useActionState } from "react";

import { setBookingLink } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

/** One row per assignment: the mentor sets the booking link students in
 * that program (or cohort) use to book them. */
function BookingLinkRow({
  assignment,
}: {
  assignment: { id: string; label: string; calendlyUrl: string | null };
}) {
  const [state, action, pending] = useActionState(setBookingLink, null);

  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <label className="block min-w-56 flex-1 text-sm">
          <span className="text-gray-600">{assignment.label}</span>
          <input
            name="calendlyUrl"
            type="url"
            required
            defaultValue={assignment.calendlyUrl ?? ""}
            placeholder="https://calendly.com/…"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}

/**
 * The mentor's booking links, one per program/cohort assignment. Students
 * only see a "Book" button once the link for their program is set.
 */
export function BookingLinksForm({
  assignments,
}: {
  assignments: { id: string; label: string; calendlyUrl: string | null }[];
}) {
  const missing = assignments.filter((a) => !a.calendlyUrl).length;

  return (
    <section className="rounded-lg border border-mist bg-white p-4">
      <h2 className="text-base font-semibold text-navy">Your booking links</h2>
      <p className="mt-1 text-xs text-gray-500">
        Students book sessions through these links (e.g. your Calendly), one
        per program you&apos;re assigned to.
        {missing > 0 &&
          " Students can't book you until the link for their program is set."}
      </p>
      <div className="mt-3 space-y-3">
        {assignments.map((a) => (
          <BookingLinkRow key={a.id} assignment={a} />
        ))}
      </div>
    </section>
  );
}
