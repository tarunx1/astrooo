"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adjustInventoryAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/action-state";

/**
 * Inline stock adjustment.
 *
 * Relative deltas rather than an absolute quantity, so two operators adjusting
 * at once compose instead of overwriting each other. A reason is mandatory: the
 * server refuses an adjustment without one, and every change lands in the audit
 * log.
 */
export function InventoryAdjustForm({
  productId,
  productVariantId,
}: {
  productId: string | null;
  productVariantId: string | null;
}) {
  const [state, action] = useActionState(adjustInventoryAction, INITIAL_ADMIN_STATE);
  const key = productVariantId ?? productId ?? "row";

  return (
    <form action={action} className="grid gap-2">
      {productId ? <input name="productId" type="hidden" value={productId} /> : null}
      {productVariantId ? <input name="productVariantId" type="hidden" value={productVariantId} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`delta-${key}`}>
          Stock change, positive to add or negative to remove
        </label>
        <input
          className="form-control w-20"
          defaultValue=""
          id={`delta-${key}`}
          inputMode="numeric"
          name="delta"
          placeholder="+/-"
          required
          type="number"
        />

        <label className="sr-only" htmlFor={`reason-${key}`}>
          Reason for this change
        </label>
        <select
          className="form-control"
          defaultValue="RESTOCK"
          id={`reason-${key}`}
          name="reason"
          required
        >
          <option value="RESTOCK">Restock</option>
          <option value="CORRECTION">Correction</option>
          <option value="DAMAGED">Damaged</option>
          <option value="RETURN">Return</option>
          <option value="MANUAL">Manual</option>
        </select>

        <Submit />
      </div>

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
      {status.pending ? "Saving..." : "Apply"}
    </button>
  );
}
