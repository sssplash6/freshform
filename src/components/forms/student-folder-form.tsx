"use client";

import { useState } from "react";

import { FolderIcon } from "@/components/icons";
import { Input } from "@/components/ui/field";
import { ExternalLink } from "@/components/ui/link";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";
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
  const saved = currentFolderUrl ?? "";
  const id = `student-folder-${studentProfileId}`;
  const [url, setUrl] = useState(saved);
  const [, action, save] = useSaveState(setStudentFolder, url !== saved);

  return (
    <Section
      eyebrow="Set by staff"
      title="Student folder"
      action={
        currentFolderUrl ? (
          <ExternalLink
            variant="chip"
            href={currentFolderUrl}
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            title="Open the student's folder"
          >
            Folder
          </ExternalLink>
        ) : undefined
      }
    >
      <div className="px-4 sm:px-5">
        <SettingsRow
          label="Folder link"
          htmlFor={id}
          description="A link to the student's folder (Drive, Docs, …). Every mentor working with them can open it from their list and their page. Leave it empty to remove the link."
          control={
            <form action={action} className="flex flex-wrap items-end gap-2">
              <input
                type="hidden"
                name="studentProfileId"
                value={studentProfileId}
              />
              {/* type="text", not "url": a pasted `drive.google.com/…` is valid
                  input here — the action https-prefixes it rather than
                  rejecting it. */}
              <Input
                id={id}
                name="folderUrl"
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://drive.google.com/…"
                className="min-w-56 flex-1"
              />
              <SubmitButton variant="secondary" pendingText="Saving…">
                Save
              </SubmitButton>
            </form>
          }
          state={<SaveState state={save} />}
        />
      </div>
    </Section>
  );
}
