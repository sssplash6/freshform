"use client";

import { useActionState } from "react";

import { ActionFeedback } from "@/components/forms/action-feedback";
import { StudentFolderLink } from "@/components/student-folder-link";
import { Input } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SubmitButton } from "@/components/ui/submit-button";
import { setStudentFolder } from "@/lib/actions/students";

/**
 * Attach or replace the student's folder link after registration — for students
 * added before they had one, or when the folder moves. Clearing the field
 * removes the link. Whatever is saved here is what their mentors see.
 */
export function StudentFolderForm({
  studentProfileId,
  currentFolderUrl,
}: {
  studentProfileId: string;
  currentFolderUrl: string | null;
}) {
  const [state, action] = useActionState(setStudentFolder, null);

  return (
    <Panel>
      <PanelHeader
        eyebrow="Set by staff"
        title="Student folder"
        action={currentFolderUrl ? <StudentFolderLink url={currentFolderUrl} /> : undefined}
      />
      <div className="px-4 py-4 sm:px-5">
      <p className="text-xs text-muted-fg">
        A link to the student&apos;s folder (Drive, Docs, …). Every mentor working
        with them can open it from their list and their page. Leave it empty to
        remove the link.
      </p>

      <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        {/* type="text", not "url": a pasted `drive.google.com/…` is valid input
            here — the action https-prefixes it rather than rejecting it. */}
        <Input
          name="folderUrl"
          type="text"
          inputMode="url"
          defaultValue={currentFolderUrl ?? ""}
          placeholder="https://drive.google.com/…"
          aria-label="Student folder link"
          className="min-w-64 flex-1"
        />
        <SubmitButton variant="secondary" pendingText="Saving…" className="min-h-11">
          Save folder link
        </SubmitButton>
      </form>
      <ActionFeedback state={state} />
      </div>
    </Panel>
  );
}
