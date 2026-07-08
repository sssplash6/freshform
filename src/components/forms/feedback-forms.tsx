"use client";

import { useActionState } from "react";

import {
  submitMentorFeedback,
  submitWebsiteFeedback,
} from "@/lib/actions/feedback";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-mist px-3.5 py-2.5 text-[15px] focus:border-navy focus:outline-none";

function RatingPicker({ name }: { name: string }) {
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="mb-1 text-sm text-gray-600">Rating *</legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label
          key={n}
          className="flex cursor-pointer flex-col items-center rounded-md border border-mist px-2.5 py-1.5 text-sm text-gray-700 transition-colors has-checked:border-brand has-checked:bg-brand/10 has-checked:text-brand-deep"
        >
          <input
            type="radio"
            name={name}
            value={n}
            required
            className="sr-only"
          />
          {n}★
        </label>
      ))}
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
    <form action={action} className="rounded-lg border border-mist bg-white p-4">
      <h2 className="text-base font-semibold text-navy">Rate a mentor</h2>
      <p className="mt-1 text-xs text-gray-500">
        Your name isn&apos;t shown to the mentor.
      </p>
      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="text-gray-600">Mentor *</span>
          <select name="mentorId" required className={inputClass}>
            <option value="">Select…</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <RatingPicker name="rating" />
        <label className="block text-sm">
          <span className="text-gray-600">Comment</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional — what went well, what could be better?"
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
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
    <form action={action} className="rounded-lg border border-mist bg-white p-4">
      <h2 className="text-base font-semibold text-navy">Rate this website</h2>
      <div className="mt-3 space-y-3">
        <RatingPicker name="rating" />
        <label className="block text-sm">
          <span className="text-gray-600">Comment</span>
          <textarea
            name="comment"
            rows={3}
            placeholder="Optional — anything confusing or missing?"
            className={inputClass}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Submit website feedback"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}
