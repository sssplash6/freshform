"use client";

import { useActionState } from "react";

import { completeMentorProfile } from "@/lib/actions/mentors";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { SubmitButton } from "@/components/ui/submit-button";

const inputClass =
  "w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

/** Self-signup step 2 for mentors: confirm the full name. */
export function MentorProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(completeMentorProfile, null);

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
      <SubmitButton pendingText="Saving…" className="w-full">
        Continue
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
