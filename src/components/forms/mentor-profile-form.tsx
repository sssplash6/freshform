"use client";

import { useActionState } from "react";

import { completeMentorProfile } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";

const inputClass =
  "w-full rounded-md border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

/** Self-signup step 2 for mentors: confirm the full name. */
export function MentorProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(completeMentorProfile, null);

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="text-muted-fg">Full name *</span>
        <input
          name="name"
          type="text"
          required
          defaultValue={defaultName}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}
