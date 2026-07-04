"use client";

import { useActionState } from "react";

import { removeAssignment } from "@/lib/actions/mentors";

export function RemoveAssignmentButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const [state, action, pending] = useActionState(removeAssignment, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this mentor from the cohort?")) e.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "…" : "Remove"}
      </button>
      {state && !state.ok && (
        <span role="alert" className="ml-2 text-xs text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}
