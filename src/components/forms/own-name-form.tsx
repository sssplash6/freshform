"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateOwnName } from "@/lib/actions/profile";

const inputClass =
  "w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

/**
 * A mentor edits the name that labels them everywhere — chips, session rows,
 * their students' booking cards. Same field as the signup step, kept editable.
 */
export function OwnNameForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(updateOwnName, null);

  return (
    <div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <label className="block min-w-56 flex-1 text-sm">
          <span className="text-muted-fg">Full name</span>
          <input
            name="name"
            type="text"
            required
            maxLength={80}
            defaultValue={defaultName}
            className={inputClass}
          />
        </label>
        <SubmitButton pendingText="Saving…">Save</SubmitButton>
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}
