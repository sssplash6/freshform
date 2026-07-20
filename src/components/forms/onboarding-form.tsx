"use client";

import { useActionState, useState } from "react";

import {
  completeOnboarding,
  completeStudentProfile,
} from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";
import type { ProgramOption } from "@/lib/queries";

const inputClass =
  "w-full rounded-md border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

function NameField({ defaultName }: { defaultName: string }) {
  return (
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
  );
}

function TelegramField() {
  return (
    <label className="block text-sm">
      <span className="text-muted-fg">Telegram username *</span>
      <input
        name="telegramUsername"
        type="text"
        required
        placeholder="@username"
        className={inputClass}
      />
      <span className="mt-1 block text-xs text-muted-fg">
        Mentors and staff use this to reach you about sessions.
      </span>
    </label>
  );
}

function SubmitButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
    >
      {pending ? "Submitting…" : label}
    </button>
  );
}

/**
 * First sign-in step for staff-registered students: confirm full name and
 * Telegram username. Their program was already set by the staff member.
 */
export function CompleteProfileForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(completeStudentProfile, null);

  return (
    <form action={action} className="space-y-4">
      <NameField defaultName={defaultName} />
      <TelegramField />
      <SubmitButton pending={pending} label="Save and continue" />
      <ActionFeedback state={state} />
    </form>
  );
}

/**
 * Self-signup fallback for emails staff didn't pre-register: the student
 * picks their program (and cohort, in programs that have them), then waits
 * for admin approval.
 */
export function OnboardingForm({
  defaultName,
  programs,
}: {
  defaultName: string;
  programs: ProgramOption[];
}) {
  const [state, action, pending] = useActionState(completeOnboarding, null);
  const [programId, setProgramId] = useState("");
  const cohorts = programs.find((p) => p.id === programId)?.cohorts ?? [];

  return (
    <form action={action} className="space-y-4">
      <NameField defaultName={defaultName} />
      <TelegramField />
      <label className="block text-sm">
        <span className="text-muted-fg">Your program *</span>
        <select
          name="programId"
          required
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select…
          </option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {cohorts.length > 0 && (
        <label className="block text-sm">
          <span className="text-muted-fg">Your cohort *</span>
          <select
            name="cohortId"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubmitButton pending={pending} label="Submit registration" />
      <ActionFeedback state={state} />
    </form>
  );
}
