"use client";

import { useId, useState } from "react";

import { setWeeklyDigest } from "@/lib/actions/email-prefs";
import { setOwnTelegram } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SettingsRow } from "@/components/ui/settings-row";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * The rows on /settings that had no form of their own, because the things they
 * change were never editable from anywhere.
 */

/**
 * A student's Telegram handle.
 *
 * Captured once during onboarding and then frozen: somebody who mistyped it,
 * or changed it later, had no way to correct it and no way to know that was
 * why nobody was messaging them.
 */
export function OwnTelegramForm({ defaultHandle }: { defaultHandle: string }) {
  const id = useId();
  const [handle, setHandle] = useState(defaultHandle);
  // No reset needed: the action revalidates, so a saved handle comes back as a
  // new `defaultHandle` and the dirty flag clears itself.
  const [, action, save] = useSaveState(setOwnTelegram, handle !== defaultHandle);

  return (
    <SettingsRow
      label="Telegram"
      htmlFor={id}
      description="How your mentors message you between sessions."
      state={<SaveState state={save} />}
      control={
        <form action={action} className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            name="telegramUsername"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="username"
            className="w-48"
          />
          <SubmitButton size="sm">Save</SubmitButton>
        </form>
      }
    />
  );
}

/**
 * The Monday email.
 *
 * It lived at the bottom of the notification feed — a list of things that have
 * already happened, which is not where anybody goes to change what will happen.
 * The other way to switch it off is still the link in the footer of the email
 * itself, for people who will not sign in to say stop.
 */
export function WeeklyDigestForm({
  defaultOn,
  student,
}: {
  defaultOn: boolean;
  /** A student's summary is about their own time; staff read delivery. */
  student: boolean;
}) {
  const id = useId();
  const [on, setOn] = useState(defaultOn);

  return (
    <SettingsRow
      label="Weekly summary"
      htmlFor={id}
      description={
        student
          ? "Every Monday: the hours you used last week and the time you still have to book, with their deadlines."
          : "Every Monday: the hours delivered last week and what remains, with the deadlines they fall under."
      }
      control={
        <form action={setWeeklyDigest} className="flex items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              id={id}
              type="checkbox"
              name="weeklyDigest"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="h-4 w-4 shrink-0 accent-brand"
            />
            {on ? "On" : "Off"}
          </label>
          <Button type="submit" variant="secondary" size="sm">
            Save
          </Button>
        </form>
      }
    />
  );
}
