"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { approveStudent, rejectStudent } from "@/lib/actions/students";

/** Approve / reject controls for one PENDING self-signed-up student. */
export function ApproveStudentButtons({
  studentProfileId,
}: {
  studentProfileId: string;
}) {
  const [approveState, approveAction, approving] = useActionState(
    approveStudent,
    null
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectStudent,
    null
  );
  const error =
    (approveState && !approveState.ok && approveState.error) ||
    (rejectState && !rejectState.ok && rejectState.error) ||
    null;

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        <Button type="submit" size="sm" disabled={approving || rejecting}>
          {approving ? "Approving…" : "Approve"}
        </Button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={approving || rejecting}
        >
          {rejecting ? "Rejecting…" : "Reject"}
        </Button>
      </form>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
