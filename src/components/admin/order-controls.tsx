"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { OrderStatus } from "@prisma/client";
import { transitionOrderAction, updateShipmentAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_STATE } from "@/lib/admin/action-state";
import { ORDER_STATUS_LABELS } from "@/lib/shop/order-status";
import { adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * Fulfilment controls.
 *
 * Only transitions the server permits from the current state are offered, and
 * the server re-checks anyway. Cancellation asks for confirmation because it is
 * not reversible.
 */
export function OrderTransitionControls({ orderId, nextStatuses }: { orderId: string; nextStatuses: OrderStatus[] }) {
  const [state, action] = useActionState(transitionOrderAction, INITIAL_ADMIN_STATE);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <form
            action={action}
            key={status}
            onSubmit={(event) => {
              if (status === "CANCELLED" && !window.confirm("Cancel this order? This cannot be undone.")) {
                event.preventDefault();
              }
            }}
          >
            <input name="orderId" type="hidden" value={orderId} />
            <input name="to" type="hidden" value={status} />
            <TransitionButton danger={status === "CANCELLED"} label={`Mark ${ORDER_STATUS_LABELS[status]}`} />
          </form>
        ))}
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
    </div>
  );
}

function TransitionButton({ label, danger }: { label: string; danger: boolean }) {
  const status = useFormStatus();
  return (
    <button
      className={`min-h-10 rounded-md border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan ${
        danger ? "border-danger/60 text-danger hover:bg-surface-hover" : "border-border-strong bg-surface hover:bg-surface-hover"
      }`}
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Working..." : label}
    </button>
  );
}

export function ShipmentForm({
  orderId,
  carrierName,
  trackingNumber,
  trackingUrl,
}: {
  orderId: string;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
}) {
  const [state, action] = useActionState(updateShipmentAction, INITIAL_ADMIN_STATE);

  return (
    <form action={action} className="grid gap-3">
      <input name="orderId" type="hidden" value={orderId} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1.5 caption text-foreground-secondary" htmlFor="carrierName">
          Carrier
          <SmoothInput className={adminInputClass} defaultValue={carrierName ?? ""} id="carrierName" name="carrierName" />
        </label>
        <label className="grid gap-1.5 caption text-foreground-secondary" htmlFor="trackingNumber">
          Tracking number
          <SmoothInput className={adminInputClass} defaultValue={trackingNumber ?? ""} id="trackingNumber" name="trackingNumber" />
        </label>
        <label className="grid gap-1.5 caption text-foreground-secondary" htmlFor="trackingUrl">
          Tracking URL
          <SmoothInput className={adminInputClass} defaultValue={trackingUrl ?? ""} id="trackingUrl" name="trackingUrl" type="url" />
        </label>
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

      <SaveShipment />
    </form>
  );
}

function SaveShipment() {
  const status = useFormStatus();
  return (
    <button
      className="min-h-10 w-full rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan sm:w-auto"
      disabled={status.pending}
      type="submit"
    >
      {status.pending ? "Saving..." : "Save shipment details"}
    </button>
  );
}
