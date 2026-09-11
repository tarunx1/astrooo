"use client";

import { PujaBookingStatus } from "@prisma/client";
import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { PUJA_STATUS_LABEL, PUJA_TRANSITIONS } from "@/lib/puja/status";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Operator controls for one puja booking.
 *
 * The moves offered come from the declared transition table, and the action
 * re-checks the same table against freshly-read state - so a stale page cannot
 * be used to schedule something already cancelled.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function AssignPanditForm({
  action,
  bookingId,
  currentPanditId,
  pandits,
}: {
  action: Action;
  bookingId: string;
  currentPanditId: string | null;
  pandits: ReadonlyArray<{ id: string; displayName: string }>;
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save assignment" variant="secondary">
      <input name="bookingId" type="hidden" value={bookingId} />

      <AdminField
        hint="Only practitioners who are currently active can be assigned."
        label="Assigned practitioner"
        name="panditProfileId"
      >
        <select
          className={adminInputClass}
          defaultValue={currentPanditId ?? ""}
          id="panditProfileId"
          name="panditProfileId"
        >
          <option value="">Unassigned</option>
          {pandits.map((pandit) => (
            <option key={pandit.id} value={pandit.id}>
              {pandit.displayName}
            </option>
          ))}
        </select>
      </AdminField>
    </AdminForm>
  );
}

export function PujaStatusControls({
  action,
  bookingId,
  status,
}: {
  action: Action;
  bookingId: string;
  status: PujaBookingStatus;
}) {
  const next = PUJA_TRANSITIONS[status];

  if (next.length === 0) {
    return <p className="caption text-slate-500">This booking is closed.</p>;
  }

  return (
    <div className="grid gap-2">
      {next.map((target) => (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={target}>
          <AdminForm
            action={action}
            confirm={
              target === PujaBookingStatus.CANCELLED
                ? "Cancel this booking? The customer is shown the reason you give."
                : undefined
            }
            pendingLabel="Saving..."
            submitLabel={`Mark ${PUJA_STATUS_LABEL[target].toLowerCase()}`}
            variant={target === PujaBookingStatus.CANCELLED ? "danger" : "secondary"}
          >
            <input name="bookingId" type="hidden" value={bookingId} />
            <input name="to" type="hidden" value={target} />

            {target === PujaBookingStatus.SCHEDULED ? (
              <AdminField
                hint="A practitioner must be assigned before a booking can be scheduled."
                label="Date and time"
                name={`scheduledAt-${bookingId}`}
              >
                <SmoothInput
                  className={adminInputClass}
                  id={`scheduledAt-${bookingId}`}
                  name="scheduledAt"
                  required
                  type="datetime-local"
                />
              </AdminField>
            ) : null}

            {target === PujaBookingStatus.CANCELLED ? (
              <AdminField label="Reason for the customer" name={`note-${bookingId}`}>
                <SmoothInput className={adminInputClass} id={`note-${bookingId}`} name="note" required />
              </AdminField>
            ) : null}
          </AdminForm>
        </div>
      ))}
    </div>
  );
}
