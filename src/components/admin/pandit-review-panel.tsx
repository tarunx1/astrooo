"use client";

import { PanditDocumentStatus, PanditOnboardingStatus } from "@prisma/client";
import { AdminField, AdminForm, adminInputClass } from "@/components/admin/admin-form";
import { SmoothInput } from "@/components/ui/smooth-input";
import { StatusBadge } from "@/components/dashboard/dashboard-shell";
import { STATUS_LABEL, STATUS_TONE, allowedTransitions } from "@/lib/pandit/onboarding";
import { DOCUMENT_TYPE_LABEL } from "@/lib/pandit/catalog";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Reviewer controls for one application.
 *
 * The available decisions come from the declared transition table, so the
 * buttons shown are exactly the moves that are legal from the current state -
 * and the action re-derives the same thing server-side, so a stale page offering
 * a decision that has since become illegal is refused rather than applied.
 *
 * Decisions the viewer lacks the permission for are not rendered; that is
 * presentation, and the action checks the permission itself.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

const DESTRUCTIVE: readonly PanditOnboardingStatus[] = [
  PanditOnboardingStatus.REJECTED,
  PanditOnboardingStatus.SUSPENDED,
];

const NEEDS_NOTE: readonly PanditOnboardingStatus[] = [
  PanditOnboardingStatus.CHANGES_REQUESTED,
  PanditOnboardingStatus.REJECTED,
  PanditOnboardingStatus.SUSPENDED,
];

export function PanditDecisionPanel({
  action,
  panditProfileId,
  status,
  can,
}: {
  action: Action;
  panditProfileId: string;
  status: PanditOnboardingStatus;
  can: { review: boolean; verify: boolean; approve: boolean; suspend: boolean };
}) {
  // Only the transitions a reviewer or approver drives. The applicant's own
  // moves are theirs to make and are not offered here.
  const options = allowedTransitions(status).filter((rule) => rule.actor !== "pandit");

  const permitted = options.filter((rule) => {
    switch (rule.to) {
      case PanditOnboardingStatus.VERIFIED:
        return can.verify;
      case PanditOnboardingStatus.APPROVED:
      case PanditOnboardingStatus.REJECTED:
        return can.approve;
      case PanditOnboardingStatus.SUSPENDED:
      case PanditOnboardingStatus.ACTIVE:
        return can.suspend;
      default:
        return can.review;
    }
  });

  if (permitted.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 body-sm text-slate-600">
        There is nothing for you to decide on this application right now.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {permitted.map((rule) => (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs" key={rule.to}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="body-sm font-semibold text-slate-900">{rule.label}</p>
            <StatusBadge label={STATUS_LABEL[rule.to]} tone={STATUS_TONE[rule.to]} />
          </div>

          <AdminForm
            action={action}
            confirm={
              DESTRUCTIVE.includes(rule.to)
                ? `${rule.label} this application? The applicant is told, and it is recorded.`
                : undefined
            }
            pendingLabel="Recording..."
            submitLabel={rule.label}
            variant={DESTRUCTIVE.includes(rule.to) ? "danger" : "primary"}
          >
            <input name="panditProfileId" type="hidden" value={panditProfileId} />
            <input name="to" type="hidden" value={rule.to} />

            {NEEDS_NOTE.includes(rule.to) ? (
              <AdminField
                hint="The applicant reads this, so say what needs to change."
                label="Reason"
                name={`note-${rule.to}`}
              >
                <textarea
                  className={adminInputClass}
                  id={`note-${rule.to}`}
                  name="note"
                  required
                  rows={3}
                />
              </AdminField>
            ) : (
              <AdminField label="Note (optional)" name={`note-${rule.to}`}>
                <SmoothInput className={adminInputClass} id={`note-${rule.to}`} name="note" />
              </AdminField>
            )}
          </AdminForm>
        </div>
      ))}
    </div>
  );
}

export function DocumentReviewForm({
  action,
  documentId,
  panditProfileId,
  documentType,
  currentStatus,
}: {
  action: Action;
  documentId: string;
  panditProfileId: string;
  documentType: keyof typeof DOCUMENT_TYPE_LABEL;
  currentStatus: PanditDocumentStatus;
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save decision" variant="secondary">
      <input name="documentId" type="hidden" value={documentId} />
      <input name="panditProfileId" type="hidden" value={panditProfileId} />

      <AdminField label={`${DOCUMENT_TYPE_LABEL[documentType]} decision`} name={`status-${documentId}`}>
        <select
          className={adminInputClass}
          defaultValue={currentStatus}
          id={`status-${documentId}`}
          name="status"
        >
          {Object.values(PanditDocumentStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </AdminField>

      <AdminField
        hint="Required when rejecting, so the applicant knows what to replace."
        label="Reason"
        name={`reason-${documentId}`}
      >
        <SmoothInput className={adminInputClass} id={`reason-${documentId}`} name="rejectionReason" />
      </AdminField>
    </AdminForm>
  );
}

export function CommissionForm({
  action,
  panditProfileId,
  current,
  platformDefault,
}: {
  action: Action;
  panditProfileId: string;
  current: number | null;
  platformDefault: number;
}) {
  return (
    <AdminForm action={action} pendingLabel="Saving..." submitLabel="Save commission" variant="secondary">
      <input name="panditProfileId" type="hidden" value={panditProfileId} />

      <AdminField
        hint={`Leave blank to use the platform default of ${platformDefault}%. Existing earnings keep the rate they were settled at.`}
        label="Commission override (%)"
        name="commissionPercent"
      >
        <SmoothInput
          className={adminInputClass}
          defaultValue={current === null ? "" : String(current)}
          id="commissionPercent"
          max={90}
          min={0}
          name="commissionPercent"
          type="number"
        />
      </AdminField>
    </AdminForm>
  );
}
