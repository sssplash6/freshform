"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { respondToInterview } from "@/lib/actions/interviews";
import { ActionFeedback } from "@/components/forms/action-feedback";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { INTERVIEW_STATUS } from "@/lib/constants";

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4 animate-spin">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * One of the two answers. Both buttons are disabled while the form is in
 * flight, but only the one that was actually pressed spins: `useFormStatus`
 * hands back the FormData being submitted, so each button can ask whether the
 * answer on its way is its own. Two spinners would say the student had somehow
 * answered both.
 */
function Answer({
  going,
  label,
  pendingLabel,
  variant,
}: {
  going: "yes" | "no";
  label: string;
  pendingLabel: string;
  variant: ButtonVariant;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("going") === going;

  return (
    <button
      type="submit"
      name="going"
      value={going}
      disabled={pending}
      aria-busy={mine}
      className={buttonClasses(variant, "sm")}
    >
      {mine && <Spinner />}
      {mine ? pendingLabel : label}
    </button>
  );
}

/**
 * The student's answer to a scheduled meeting. Two buttons in ONE form, each
 * submitting its own value, because the answer IS which one was pressed — a
 * radio plus a save button would be three interactions for a yes.
 *
 * Both stay available after an answer: plans change, and a student who
 * confirmed on Monday and can't make Thursday needs a way to say so that isn't
 * silence. The one they already chose reads as the quieter of the two.
 */
export function InterviewResponse({
  interviewId,
  status,
}: {
  interviewId: string;
  status: string;
}) {
  const [state, action] = useActionState(respondToInterview, null);
  const confirmed = status === INTERVIEW_STATUS.CONFIRMED;
  const declined = status === INTERVIEW_STATUS.DECLINED;

  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="interviewId" value={interviewId} />
        <Answer
          going="yes"
          label={confirmed ? "You're confirmed" : "I'll be there"}
          pendingLabel="Confirming…"
          variant={confirmed ? "ghost" : "primary"}
        />
        <Answer
          going="no"
          label={declined ? "You said you can't make it" : "I can't make it"}
          pendingLabel="Letting them know…"
          variant={declined ? "ghost" : "danger"}
        />
      </form>
      <ActionFeedback state={state} />
    </div>
  );
}
