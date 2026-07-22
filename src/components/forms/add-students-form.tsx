"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Button } from "@/components/ui/button";
import { Field, Textarea, inputClasses } from "@/components/ui/field";
import { createStudents } from "@/lib/actions/students";
import { EMAIL_RE, normalizeEmail } from "@/lib/actions/shared";
import { cn } from "@/lib/cn";
import type { ProgramOption } from "@/lib/queries";

/**
 * Staff pastes a list of student emails into ONE program (a cohort is only
 * asked for in programs that have them). We parse the paste as they type so
 * they can see exactly how many valid addresses will be enrolled — and which
 * ones need fixing — before submitting. Each student confirms their name and
 * Telegram username on first sign-in.
 */
export function AddStudentsForm({ program }: { program: ProgramOption }) {
  const [state, action, pending] = useActionState(createStudents, null);
  const [raw, setRaw] = useState("");

  const { valid, invalid } = useMemo(() => {
    const entries = [
      ...new Set(raw.split(/[\s,;]+/).map(normalizeEmail).filter(Boolean)),
    ];
    return {
      valid: entries.filter((e) => EMAIL_RE.test(e)),
      invalid: entries.filter((e) => !EMAIL_RE.test(e)),
    };
  }, [raw]);

  // Clear the paste box once the students have been added.
  useEffect(() => {
    if (state?.ok) setRaw("");
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="programId" value={program.id} />
      <Field
        label="Add students by email"
        hint="Paste one or many, separated by new lines, commas or spaces."
      >
        <Textarea
          name="emails"
          required
          rows={3}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"ada@example.com\ngrace@example.com"}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-fg" aria-live="polite">
          {(valid.length > 0 || invalid.length > 0) && (
            <>
              <span className="font-medium tabular-nums text-ink">
                {valid.length}
              </span>{" "}
              ready to add
              {invalid.length > 0 && (
                <>
                  {" · "}
                  <span className="font-medium tabular-nums text-red-700">
                    {invalid.length}
                  </span>{" "}
                  need a valid address
                </>
              )}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {program.cohorts.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-fg">
            Cohort
            <select
              name="cohortId"
              required
              defaultValue={
                program.cohorts.length === 1 ? program.cohorts[0].id : ""
              }
              className={cn(inputClasses, "w-auto")}
            >
              <option value="" disabled>
                Select…
              </option>
              {program.cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
          <Button type="submit" disabled={pending || valid.length === 0}>
            {pending
              ? "Adding…"
              : valid.length > 0
                ? `Add ${valid.length} student${valid.length === 1 ? "" : "s"}`
                : `Add to ${program.name}`}
          </Button>
        </div>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
