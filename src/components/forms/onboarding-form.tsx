"use client";

import { useState } from "react";

import {
  completeOnboarding,
  completeStudentProfile,
} from "@/lib/actions/students";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ProgramOption } from "@/lib/queries";

const inputClass =
  "w-full rounded-lg border border-line px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none";

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

/**
 * First sign-in step for staff-registered students: confirm full name and
 * Telegram username. Their program was already set by the staff member.
 */
export function CompleteProfileForm({ defaultName }: { defaultName: string }) {
  const [, action, save] = useSaveState(completeStudentProfile);

  return (
    <form action={action} className="space-y-4">
      <NameField defaultName={defaultName} />
      <TelegramField />
      <SubmitButton pendingText="Submitting…" className="w-full">
        Save and continue
      </SubmitButton>
      <SaveState state={save} />
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
  const [, action, save] = useSaveState(completeOnboarding);
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
      <SubmitButton pendingText="Submitting…" className="w-full">
        Submit registration
      </SubmitButton>
      <SaveState state={save} />
    </form>
  );
}
