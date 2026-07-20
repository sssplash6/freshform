"use client";

import { useActionState, useState } from "react";

import {
  submitMentorFeedback,
  submitWebsiteFeedback,
} from "@/lib/actions/feedback";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { StarIcon } from "@/components/icons";
import { Select } from "@/components/select";

const inputClass =
  "w-full rounded-md border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

/** Native radio inputs retain expected keyboard behavior while labels render
 * as a large, tap-friendly star picker. */
function StarRating({ name, idPrefix }: { name: string; idPrefix: string }) {
  const [value, setValue] = useState(0);
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;

  return (
    <fieldset className="block text-sm">
      <legend className="text-muted-fg">Rating *</legend>
      <div
        className="mt-1 flex items-center gap-0.5"
        onMouseLeave={() => setHovered(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="inline-flex"
            onMouseEnter={() => setHovered(n)}
          >
            <input
              id={`${idPrefix}-${n}`}
              type="radio"
              name={name}
              value={n}
              required={n === 1}
              checked={value === n}
              onChange={() => setValue(n)}
              className="peer sr-only"
            />
            <label
              htmlFor={`${idPrefix}-${n}`}
              className={`inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ${
                n <= shown ? "text-accent" : "text-line"
              }`}
            >
            <StarIcon
              className="h-7 w-7"
              aria-hidden="true"
            />
            <span className="sr-only">{n} star{n === 1 ? "" : "s"}</span>
            </label>
          </span>
        ))}
        {shown > 0 && (
          <span className="ml-2 text-sm font-medium tabular-nums text-muted-fg">
            {shown}/5
          </span>
        )}
      </div>
    </fieldset>
  );
}

export function MentorFeedbackForm({
  mentors,
}: {
  mentors: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(submitMentorFeedback, null);

  return (
    <form action={action} className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Rate a mentor</h2>
      <p className="mt-1 text-xs text-muted-fg">
        Your name isn&apos;t shown to the mentor.
      </p>
      <div className="mt-3 space-y-3">
        <div className="block text-sm">
          <span className="text-muted-fg">Mentor *</span>
          <div className="mt-0.5">
            <Select
              name="mentorId"
              ariaLabel="Mentor"
              options={mentors.map((m) => ({ value: m.id, label: m.label }))}
            />
          </div>
        </div>
        <StarRating name="rating" idPrefix="mentor-rating" />
        <label className="block text-sm">
          <span className="text-muted-fg">Comment</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional: what went well, what could be better?"
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit mentor feedback"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function WebsiteFeedbackForm() {
  const [state, action, pending] = useActionState(submitWebsiteFeedback, null);

  return (
    <form action={action} className="rounded-lg border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Rate this website</h2>
      <div className="mt-3 space-y-3">
        <StarRating name="rating" idPrefix="website-rating" />
        <label className="block text-sm">
          <span className="text-muted-fg">Comment</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional: anything confusing or missing?"
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit website feedback"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}
