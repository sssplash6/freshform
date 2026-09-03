import { CheckIcon } from "@/components/icons";
import type { ActionState } from "@/lib/actions/shared";

/**
 * Inline success or error under a form driven by `useActionState`.
 *
 * Success is a tick in ink rather than green text: green was the only place in
 * the app where "it worked" wore a colour, and a palette with two status hues
 * should not spend one on the expected outcome.
 */
export function ActionFeedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="rise-in mt-2 flex items-baseline gap-1.5 text-sm text-ink">
        <CheckIcon className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
        {state.message}
      </p>
    ) : null;
  }
  return (
    <p role="alert" className="rise-in mt-2 text-sm text-danger-ink">
      {state.error}
    </p>
  );
}
