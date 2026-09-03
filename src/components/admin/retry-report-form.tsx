"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { retryReportAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/action-state";

/**
 * Re-queues a failed report.
 *
 * The original order, its price snapshot and its immutable AstrologyCalculation
 * are all preserved, and the customer is not charged again.
 */
export function RetryReportForm({ generatedReportId }: { generatedReportId: string }) {
  const [state, action] = useActionState(retryReportAction, INITIAL_ADMIN_STATE);

  return (
    <form
      action={action}
      className="grid gap-1.5"
      onSubmit={(event) => {
        if (!window.confirm("Re-queue this report? The customer will not be charged again.")) event.preventDefault();
      }}
    >
      <input name="generatedReportId" type="hidden" value={generatedReportId} />
      <Submit />
      <div aria-live="polite">
        {state.error ? (
          <p className="caption text-danger" role="alert">
            {state.error}
          </p>
        ) : state.ok && state.message ? (
          <p className="caption text-success" role="status">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Submit() {
  const status = useFormStatus();
  return (
    <button
      className="min-h-9 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Re-queueing..." : "Retry"}
    </button>
  );
}
