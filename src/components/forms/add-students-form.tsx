"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Button } from "@/components/ui/button";
import { Input, inputClasses } from "@/components/ui/field";
import { createStudents } from "@/lib/actions/students";
import { EMAIL_RE, normalizeEmail } from "@/lib/actions/shared";
import { cn } from "@/lib/cn";
import type { ProgramOption } from "@/lib/queries";

type Row = { id: number; email: string; name: string };

/**
 * Staff registers students into ONE program by entering an email + full name
 * per student (a cohort is only asked for in programs that have them). Extra
 * rows are added on demand; each student still confirms their name and
 * Telegram username on first sign-in, so the name here is a helpful default.
 */
export function AddStudentsForm({ program }: { program: ProgramOption }) {
  const [state, action, pending] = useActionState(createStudents, null);
  // Ids only advance in handlers/effects, never during render.
  const nextId = useRef(2);
  const blank = (): Row => ({ id: nextId.current++, email: "", name: "" });
  const [rows, setRows] = useState<Row[]>([
    { id: 0, email: "", name: "" },
    { id: 1, email: "", name: "" },
  ]);

  const validCount = rows.filter((r) =>
    EMAIL_RE.test(normalizeEmail(r.email)),
  ).length;

  // Reset to two empty rows once the students have been added.
  useEffect(() => {
    if (state?.ok) setRows([blank(), blank()]);
  }, [state]);

  const update = (id: number, field: "email" | "name", value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="programId" value={program.id} />

      <div className="space-y-2">
        <div className="text-sm font-medium text-ink">Add students</div>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2">
            <Input
              name="email"
              type="email"
              value={r.email}
              onChange={(e) => update(r.id, "email", e.target.value)}
              placeholder="student@example.com"
              aria-label={`Student ${i + 1} email`}
              className="flex-1"
            />
            <Input
              name="name"
              type="text"
              value={r.name}
              onChange={(e) => update(r.id, "name", e.target.value)}
              placeholder="Full name"
              aria-label={`Student ${i + 1} name`}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              disabled={rows.length === 1}
              aria-label={`Remove student ${i + 1}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-canvas hover:text-red-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-fg"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, blank()])}
          className="text-sm font-medium text-brand transition-colors hover:text-brand-dark"
        >
          + Add another student
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-fg" aria-live="polite">
          {validCount > 0 && (
            <>
              <span className="font-medium tabular-nums text-ink">
                {validCount}
              </span>{" "}
              ready to add
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
          <Button type="submit" disabled={pending || validCount === 0}>
            {pending
              ? "Adding…"
              : validCount > 0
                ? `Add ${validCount} student${validCount === 1 ? "" : "s"}`
                : `Add to ${program.name}`}
          </Button>
        </div>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
