"use client";

import { useActionState, useState } from "react";

import { deleteStudent, moveStudent } from "@/lib/actions/students";
import { ActionFeedback } from "@/components/forms/action-feedback";
import type { ProgramOption } from "@/lib/queries";

const selectClass =
  "min-h-11 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink transition hover:border-brand/40 focus:border-brand focus:outline-none";

/**
 * Admin corrections for a mis-enrolled student: move them to the right
 * cohort/program (hours and history follow), or remove the record entirely
 * while no sessions exist.
 */
export function StudentCorrections({
  studentProfileId,
  programs,
  currentProgramId,
  currentCohortId,
  hasSessions,
}: {
  studentProfileId: string;
  programs: ProgramOption[];
  currentProgramId: string;
  currentCohortId: string | null;
  hasSessions: boolean;
}) {
  const [moveState, moveAction, movePending] = useActionState(moveStudent, null);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteStudent, null);
  const [programId, setProgramId] = useState(currentProgramId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const cohorts = programs.find((p) => p.id === programId)?.cohorts ?? [];

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">Corrections</h2>
      <p className="mt-1 text-xs text-muted-fg">
        Enrolled in the wrong place? Move them — hours and session history
        follow. The student is notified.
      </p>

      <form action={moveAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input type="hidden" name="studentProfileId" value={studentProfileId} />
        <select
          name="programId"
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          aria-label="Program"
          className={selectClass}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {cohorts.length > 0 && (
          <select
            name="cohortId"
            required
            defaultValue={programId === currentProgramId ? currentCohortId ?? "" : ""}
            aria-label="Cohort"
            className={selectClass}
          >
            <option value="" disabled>
              Pick a cohort…
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={movePending}
          className="min-h-11 rounded-lg border border-brand px-3.5 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white disabled:opacity-50"
        >
          {movePending ? "Moving…" : "Move student"}
        </button>
      </form>
      <ActionFeedback state={moveState} />

      <div className="mt-4 border-t border-line pt-4">
        <form action={deleteAction}>
          <input type="hidden" name="studentProfileId" value={studentProfileId} />
          {hasSessions ? (
            <p className="text-xs text-muted-fg">
              This student has logged sessions, so their record can&apos;t be
              deleted — it&apos;s part of the hour ledger now.
            </p>
          ) : confirmingDelete ? (
            <span className="rise-in flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-fg">
                Removes the account, enrollment, and any allocations. This
                can&apos;t be undone.
              </span>
              <button
                type="submit"
                disabled={deletePending}
                className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
              >
                {deletePending ? "Removing…" : "Yes, remove them"}
              </button>
              <button
                type="button"
                disabled={deletePending}
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-fg transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              Remove this student
            </button>
          )}
        </form>
        <ActionFeedback state={deleteState} />
      </div>
    </section>
  );
}
