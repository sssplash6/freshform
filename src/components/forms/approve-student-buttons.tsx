"use client";

import { Button } from "@/components/ui/button";
import { SaveState, useSaveState } from "@/components/ui/save-state";
import { approveStudent, rejectStudent } from "@/lib/actions/students";

/**
 * Approve / reject controls for one PENDING self-signed-up student.
 *
 * Two actions, so two `SaveState`s rather than the single hand-written
 * `<span role="alert">` that used to print whichever of the two errors was
 * set. That span was mounted only once there was something to say, which is
 * the one thing a live region must not do — several screen readers only watch
 * regions that were already there — so the error it existed to announce was
 * the error nobody heard. Both of these mount empty and stay mounted; when
 * neither has anything to say they occupy no height.
 */
export function ApproveStudentButtons({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [, approveAction, approveSave] = useSaveState(approveStudent);
  const [, rejectAction, rejectSave] = useSaveState(rejectStudent);
  // Either answer settles the row, so neither is offered while the other is in
  // flight — a double answer would be two writes racing over one decision.
  const busy = approveSave.kind === "saving" || rejectSave.kind === "saving";

  return (
    <div>
      <div className="flex items-center gap-2">
        <form action={approveAction}>
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          <Button type="submit" size="sm" disabled={busy}>
            {approveSave.kind === "saving" ? "Approving…" : "Approve"}
          </Button>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          <Button type="submit" variant="danger" size="sm" disabled={busy}>
            {rejectSave.kind === "saving" ? "Rejecting…" : "Reject"}
          </Button>
        </form>
      </div>
      <SaveState state={approveSave} />
      <SaveState state={rejectSave} />
    </div>
  );
}
