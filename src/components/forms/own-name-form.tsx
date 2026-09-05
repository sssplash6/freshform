"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/field";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SettingsRow } from "@/components/ui/settings-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateOwnName } from "@/lib/actions/profile";

/**
 * A mentor edits the name that labels them everywhere — chips, session rows,
 * their students' booking cards. Same field as the signup step, kept editable.
 */
export function OwnNameForm({ defaultName }: { defaultName: string }) {
  const id = useId();
  const [name, setName] = useState(defaultName);
  // The comparison needs no reset: the action revalidates, so a saved name
  // comes back as a new `defaultName` and this goes false on its own.
  const [, action, save] = useSaveState(updateOwnName, name !== defaultName);

  return (
    <SettingsRow
      label="Full name"
      htmlFor={id}
      description="What everyone reads you by — session rows, chips, your students' booking cards."
      control={
        <form action={action} className="flex flex-wrap items-end gap-2">
          <Input
            id={id}
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-w-56 flex-1"
          />
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
        </form>
      }
      state={<SaveState state={save} />}
    />
  );
}
