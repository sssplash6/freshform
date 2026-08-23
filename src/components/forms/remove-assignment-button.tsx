"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { removeAssignment } from "@/lib/actions/mentors";

/**
 * Remove a mentor↔program assignment. Uses the app's inline two-step confirm
 * (like voiding a session or deleting a student) rather than a native
 * confirm() dialog, so the whole app confirms destructive actions the same way.
 */
export function RemoveAssignmentButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [state, action] = useActionState(removeAssignment, null);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Remove
        </Button>
        {state && !state.ok && (
          <span role="alert" className="text-xs text-red-700">
            {state.error}
          </span>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="rise-in inline-flex items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <span className="text-xs text-muted-fg">Remove assignment?</span>
      <SubmitButton variant="danger" size="sm" pendingText="Removing…">
        Yes, remove
      </SubmitButton>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </form>
  );
}
