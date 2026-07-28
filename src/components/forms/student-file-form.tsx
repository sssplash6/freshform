"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { StudentFileLink } from "@/components/student-file-link";
import { Input } from "@/components/ui/field";
import { setStudentFile } from "@/lib/actions/students";

/**
 * Attach or replace the student's file link after registration — for students
 * added before they had a file, or when the document moves. Clearing the field
 * removes the link. Whatever is saved here is what their mentors see.
 */
export function StudentFileForm({
  studentProfileId,
  currentFileUrl,
}: {
  studentProfileId: string;
  currentFileUrl: string | null;
}) {
  const [state, action, pending] = useActionState(setStudentFile, null);

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-ink">Student file</h2>
        {currentFileUrl && <StudentFileLink url={currentFileUrl} />}
      </div>
      <p className="mt-1 text-xs text-muted-fg">
        A link to the student&apos;s file (Drive, Docs, …). Every mentor working
        with them can open it from their list and their page. Leave it empty to
        remove the link.
      </p>

      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        {/* type="text", not "url": a pasted `drive.google.com/…` is valid input
            here — the action https-prefixes it rather than rejecting it. */}
        <Input
          name="fileUrl"
          type="text"
          inputMode="url"
          defaultValue={currentFileUrl ?? ""}
          placeholder="https://drive.google.com/…"
          aria-label="Student file link"
          className="min-w-64 flex-1"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg border border-brand px-3.5 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save file link"}
        </button>
      </form>
      <ActionFeedback state={state} />
    </section>
  );
}
