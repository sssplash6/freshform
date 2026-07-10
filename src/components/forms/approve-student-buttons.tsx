"use client";

import { useActionState } from "react";

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
        <button
          type="submit"
          disabled={approving || rejecting}
          className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {approving ? "Approving…" : "Approve"}
        </button>
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        <button
          type="submit"
          disabled={approving || rejecting}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          {rejecting ? "Rejecting…" : "Reject"}
        </button>
      </form>
      {error && (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
