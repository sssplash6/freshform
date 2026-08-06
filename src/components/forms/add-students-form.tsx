"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { Button } from "@/components/ui/button";
import { Input, inputClasses } from "@/components/ui/field";
import { createStudents } from "@/lib/actions/students";
import { EMAIL_RE, normalizeEmail } from "@/lib/actions/shared";
import { cn } from "@/lib/cn";
import type { ProgramOption } from "@/lib/queries";

type Row = { id: number; email: string; name: string; folderUrl: string };

/**
 * Staff registers students into ONE program by entering an email + full name
 * + optional student-folder link per student (a cohort is only asked for in
 * programs that have them). Extra rows are added on demand; each student still
 * confirms their name and Telegram username on first sign-in, so the name here
 * is a helpful default.
 */
export function AddStudentsForm({ program }: { program: ProgramOption }) {
  const [state, action, pending] = useActionState(createStudents, null);
  // Ids only advance in handlers/effects, never during render.
  const nextId = useRef(2);
  const blank = (): Row => ({
    id: nextId.current++,
    email: "",
    name: "",
    folderUrl: "",
  });
  const [rows, setRows] = useState<Row[]>([
    { id: 0, email: "", name: "", folderUrl: "" },
    { id: 1, email: "", name: "", folderUrl: "" },
  ]);

  // A row is ready when it has both halves of an identity: the address they sign
  // in with, and the name everyone will read them by.
  const validCount = rows.filter(
    (r) => EMAIL_RE.test(normalizeEmail(r.email)) && r.name.trim().length > 0,
  ).length;

  // Reset to two empty rows once the students have been added.
  useEffect(() => {
    if (state?.ok) setRows([blank(), blank()]);
  }, [state]);

  const update = (
    id: number,
    field: "email" | "name" | "folderUrl",
    value: string,
  ) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="programId" value={program.id} />

      <div className="space-y-2">
        <div className="text-sm font-medium text-ink">Add students</div>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-start gap-2">
            <div className="grid flex-1 gap-2 sm:grid-cols-3">
              <Input
                name="email"
                type="email"
                value={r.email}
                onChange={(e) => update(r.id, "email", e.target.value)}
                placeholder="student@example.com"
                aria-label={`Student ${i + 1} email`}
              />
              <Input
                name="name"
                type="text"
                value={r.name}
                onChange={(e) => update(r.id, "name", e.target.value)}
                placeholder="Full name"
                aria-label={`Student ${i + 1} full name`}
              />
              {/* Not type="url": native validation would reject a pasted
                  `drive.google.com/…`, which the action accepts and https-fixes. */}
              <Input
                name="folderUrl"
                type="text"
                inputMode="url"
                value={r.folderUrl}
                onChange={(e) => update(r.id, "folderUrl", e.target.value)}
                placeholder="Student folder (link)"
                aria-label={`Student ${i + 1} folder link`}
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
              disabled={rows.length === 1}
              aria-label={`Remove student ${i + 1}`}
              className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-muted-fg transition-colors hover:bg-canvas hover:text-red-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-fg"
            >
              ✕
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, blank()])}
            className="text-sm font-medium text-brand transition-colors hover:text-brand-dark"
          >
            + Add another student
          </button>
          <p className="text-xs text-muted-fg">
            Email and full name are both needed. The folder link is optional —
            paste the student&apos;s Drive or Docs URL and their mentors can open
            it from their page.
          </p>
        </div>
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
