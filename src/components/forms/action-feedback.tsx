import type { ActionState } from "@/lib/actions/shared";

/** Inline success/error line under a form driven by useActionState. */
export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="rise-in mt-2 text-sm text-green-700">
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rise-in mt-2 text-sm text-red-700">
      {state.error}
    </p>
  );
}
