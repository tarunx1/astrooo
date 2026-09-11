"use client";

import { PayoutStatus } from "@prisma/client";
import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { PAYOUT_TRANSITIONS } from "@/lib/payouts/states";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Payout controls.
 *
 * The moves offered come from the declared transition table, so a payout that
 * has been paid shows nothing to press, and the action re-checks the same table
 * against the state it re-reads - a stale page cannot walk a payout backwards.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

const LABEL: Record<PayoutStatus, string> = {
  [PayoutStatus.PENDING]: "Move to pending",
  [PayoutStatus.ELIGIBLE]: "Release",
  [PayoutStatus.PROCESSING]: "Start processing",
  [PayoutStatus.PAID]: "Mark paid",
  [PayoutStatus.FAILED]: "Mark failed",
  [PayoutStatus.HELD]: "Hold",
};

export function PayoutControls({
  action,
  payoutId,
  status,
}: {
  action: Action;
  payoutId: string;
  status: PayoutStatus;
}) {
  const next = PAYOUT_TRANSITIONS[status];

  if (next.length === 0) {
    return <p className="caption text-slate-500">Settled. Nothing further to do.</p>;
  }

  return (
    <div className="grid gap-2">
      {next.map((target) => (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3" key={target}>
          <AdminForm
            action={action}
            confirm={
              target === PayoutStatus.PAID
                ? "Mark this payout paid? Do this only after the transfer has actually been made."
                : undefined
            }
            pendingLabel="Saving..."
            submitLabel={LABEL[target]}
            variant={target === PayoutStatus.FAILED ? "danger" : "secondary"}
          >
            <input name="payoutId" type="hidden" value={payoutId} />
            <input name="to" type="hidden" value={target} />

            {target === PayoutStatus.PAID ? (
              <AdminField
                hint="The UTR or bank reference for the transfer you made, so this can be reconciled later."
                label="Transfer reference"
                name={`reference-${payoutId}`}
              >
                <SmoothInput
                  className={adminInputClass}
                  id={`reference-${payoutId}`}
                  name="reference"
                  required
                />
              </AdminField>
            ) : null}

            {target === PayoutStatus.FAILED || target === PayoutStatus.HELD ? (
              <AdminField label="Reason" name={`reason-${payoutId}-${target}`}>
                <SmoothInput
                  className={adminInputClass}
                  id={`reason-${payoutId}-${target}`}
                  name="reason"
                  required={target === PayoutStatus.FAILED}
                />
              </AdminField>
            ) : null}
          </AdminForm>
        </div>
      ))}
    </div>
  );
}

export function RaisePayoutForm({ action, panditProfileId }: { action: Action; panditProfileId: string }) {
  return (
    <AdminForm action={action} pendingLabel="Raising..." submitLabel="Raise payout" variant="secondary">
      <input name="panditProfileId" type="hidden" value={panditProfileId} />
    </AdminForm>
  );
}

export function ReleaseEarningsForm({ action }: { action: Action }) {
  return (
    <AdminForm action={action} pendingLabel="Checking..." submitLabel="Release matured earnings" variant="secondary">
      <p className="caption text-slate-600">
        Moves earnings past their holding period from pending to eligible. Safe to run repeatedly - it only
        touches rows whose holding period has actually elapsed.
      </p>
    </AdminForm>
  );
}

export function PayoutSettingsForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: {
    cycle: string;
    cycleAnchorDay: string;
    holdingPeriodDays: string;
    minimumRupees: string;
    platformCommissionPercent: string;
  };
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save payout rules">
      {(state) => (
        <>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 caption text-slate-700">
            These decide what every Pandit is owed on work done from now on. Earnings already settled keep the
            commission they were settled at and are not rewritten.
          </p>

          <AdminField label="Payout cycle" name="cycle">
            <select className={adminInputClass} defaultValue={defaults.cycle} id="cycle" name="cycle">
              <option value="WEEKLY">Weekly</option>
              <option value="BIWEEKLY">Every two weeks</option>
              <option value="MONTHLY">Monthly</option>
              <option value="MANUAL">On request only</option>
            </select>
          </AdminField>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              error={state.fieldErrors.cycleAnchorDay?.[0]}
              hint="Day of the week (1 = Monday) for weekly, or day of the month for monthly. Capped at 28."
              label="Cycle day"
              name="cycleAnchorDay"
            >
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.cycleAnchorDay}
                id="cycleAnchorDay"
                max={28}
                min={1}
                name="cycleAnchorDay"
                type="number"
              />
            </AdminField>

            <AdminField
              error={state.fieldErrors.holdingPeriodDays?.[0]}
              hint="How long after a consultation completes before its earning becomes payable."
              label="Holding period (days)"
              name="holdingPeriodDays"
            >
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.holdingPeriodDays}
                id="holdingPeriodDays"
                max={90}
                min={0}
                name="holdingPeriodDays"
                type="number"
              />
            </AdminField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AdminField
              error={state.fieldErrors.minimumRupees?.[0]}
              hint="Balances below this roll into the next cycle."
              label="Minimum payout (₹)"
              name="minimumRupees"
            >
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.minimumRupees}
                id="minimumRupees"
                min={0}
                name="minimumRupees"
                step="0.01"
                type="number"
              />
            </AdminField>

            <AdminField
              error={state.fieldErrors.platformCommissionPercent?.[0]}
              hint="The default share the platform keeps. Individual Pandits may carry an override."
              label="Platform commission (%)"
              name="platformCommissionPercent"
            >
              <SmoothInput
                className={adminInputClass}
                defaultValue={defaults.platformCommissionPercent}
                id="platformCommissionPercent"
                max={90}
                min={0}
                name="platformCommissionPercent"
                type="number"
              />
            </AdminField>
          </div>
        </>
      )}
    </AdminForm>
  );
}

export function HoldEarningForm({
  action,
  earningId,
  held,
}: {
  action: Action;
  earningId: string;
  held: boolean;
}) {
  return (
    <AdminForm
      action={action}
      pendingLabel="Saving..."
      submitLabel={held ? "Release hold" : "Hold"}
      variant="secondary"
    >
      <input name="earningId" type="hidden" value={earningId} />
      <input name="hold" type="hidden" value={held ? "false" : "true"} />

      {!held ? (
        <AdminField label="Reason" name={`hold-reason-${earningId}`}>
          <SmoothInput
            className={adminInputClass}
            id={`hold-reason-${earningId}`}
            name="reason"
            required
          />
        </AdminField>
      ) : null}
    </AdminForm>
  );
}
