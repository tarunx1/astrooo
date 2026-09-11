import Link from "next/link";
import { PanditDocumentStatus } from "@prisma/client";
import {
  AuditTimeline,
  DashboardSection,
  EmptyState,
  StatusBadge,
} from "@/components/dashboard/dashboard-shell";
import {
  CommissionForm,
  DocumentReviewForm,
  PanditDecisionPanel,
} from "@/components/admin/pandit-review-panel";
import { DOCUMENT_TYPE_LABEL, MODE_LABEL, RATE_TYPE_LABEL } from "@/lib/pandit/catalog";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/pandit/onboarding";
import { formatPaise } from "@/lib/payouts/ledger";
import type { PanditDetail } from "@/lib/pandit/queries";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * One application, as a reviewer sees it.
 *
 * Shared by `/admin` and `/employee` so there is one rendering of a case file
 * rather than two that drift. What differs between the two areas is which
 * decisions the viewer may take, and that is passed in - and re-checked by the
 * actions themselves.
 *
 * Documents are never linked to storage directly: each opens through an
 * authorized route that checks the viewer and mints a short-lived URL.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

const DOCUMENT_TONE = {
  [PanditDocumentStatus.PENDING]: "warning",
  [PanditDocumentStatus.ACCEPTED]: "positive",
  [PanditDocumentStatus.REJECTED]: "danger",
} as const;

export function PanditCaseFile({
  detail,
  can,
  reviewAction,
  documentAction,
  commissionAction,
  platformCommission,
}: {
  detail: PanditDetail;
  can: {
    review: boolean;
    verify: boolean;
    approve: boolean;
    suspend: boolean;
    setCommission: boolean;
  };
  reviewAction: Action;
  documentAction: Action;
  commissionAction?: Action;
  platformCommission: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-6">
        <DashboardSection title="Applicant">
          <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-2">
            <Field label="Name" value={detail.displayName || detail.user.name} />
            <Field label="Email" value={detail.user.email} />
            <Field label="Phone" value={detail.phone ?? "Not given"} />
            <Field
              label="Location"
              value={[detail.city, detail.state, detail.country].filter(Boolean).join(", ") || "Not given"}
            />
            <Field
              label="Experience"
              value={detail.yearsOfExperience === null ? "Not given" : `${detail.yearsOfExperience} years`}
            />
            <Field label="Timezone" value={detail.timezone} />
            <Field
              label="Specialisations"
              value={detail.expertise.length > 0 ? detail.expertise.join(", ") : "None selected"}
            />
            <Field
              label="Languages"
              value={detail.languages.length > 0 ? detail.languages.join(", ") : "None selected"}
            />
            {detail.certifications.length > 0 ? (
              <Field label="Certifications" value={detail.certifications.join(", ")} />
            ) : null}
            <Field
              label="Applied"
              value={detail.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
          </dl>

          {detail.bio ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <p className="caption font-semibold uppercase tracking-wider text-slate-500">Bio</p>
              <p className="mt-2 body-sm whitespace-pre-wrap text-slate-800">{detail.bio}</p>
            </div>
          ) : null}
        </DashboardSection>

        <DashboardSection
          description="Opened through an authorized link that expires. Every read is recorded."
          title="Verification documents"
        >
          {detail.documents.length === 0 ? (
            <EmptyState
              description="The applicant has not uploaded anything yet."
              title="No documents"
            />
          ) : (
            <div className="grid gap-3">
              {detail.documents.map((document) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs" key={document.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="body-sm font-semibold text-slate-900">
                        {DOCUMENT_TYPE_LABEL[document.type]}
                      </p>
                      <p className="caption text-slate-500">
                        {document.fileName} · {(document.fileSize / 1024).toFixed(0)} KB ·{" "}
                        {document.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={document.status} tone={DOCUMENT_TONE[document.status]} />
                      <Link
                        className="text-sm font-semibold text-blue-700 underline"
                        href={`/api/pandit-documents/${document.id}`}
                        prefetch={false}
                        rel="noopener"
                        target="_blank"
                      >
                        Open
                      </Link>
                    </div>
                  </div>

                  {document.note ? (
                    <p className="mt-2 caption text-slate-600">Applicant’s note: {document.note}</p>
                  ) : null}
                  {document.rejectionReason ? (
                    <p className="mt-2 caption text-rose-700">{document.rejectionReason}</p>
                  ) : null}

                  {can.review ? (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <DocumentReviewForm
                        action={documentAction}
                        currentStatus={document.status}
                        documentId={document.id}
                        documentType={document.type}
                        panditProfileId={detail.id}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </DashboardSection>

        {detail.services.length > 0 ? (
          <DashboardSection title="Services and rates">
            <ul className="grid gap-2">
              {detail.services.map((service) => (
                <li
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
                  key={service.id}
                >
                  <span className="body-sm font-semibold text-slate-900">{MODE_LABEL[service.mode]}</span>
                  <StatusBadge
                    label={service.enabled ? "Offered" : "Off"}
                    tone={service.enabled ? "positive" : "neutral"}
                  />
                  <span className="caption text-slate-600">
                    {formatPaise(service.ratePaise)} · {RATE_TYPE_LABEL[service.rateType]}
                    {service.sessionMinutes ? ` · ${service.sessionMinutes} min` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </DashboardSection>
        ) : null}

        <DashboardSection title="Review history">
          <AuditTimeline
            entries={detail.reviewTrail.map((entry) => ({
              id: entry.id,
              title: STATUS_LABEL[entry.toStatus],
              detail: entry.note,
              actor: entry.reviewer?.name || entry.reviewer?.email || "Applicant",
              at: entry.createdAt,
              tone: STATUS_TONE[entry.toStatus],
            }))}
          />
        </DashboardSection>
      </div>

      <div className="grid gap-4 self-start">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <p className="caption font-semibold uppercase tracking-wider text-slate-500">Current status</p>
          <div className="mt-2">
            <StatusBadge label={STATUS_LABEL[detail.status]} tone={STATUS_TONE[detail.status]} />
          </div>

          <dl className="mt-4 grid gap-2">
            {detail.submittedAt ? (
              <TimestampRow label="Submitted" value={detail.submittedAt} />
            ) : null}
            {detail.reviewStartedAt ? (
              <TimestampRow label="Review started" value={detail.reviewStartedAt} />
            ) : null}
            {detail.verifiedAt ? <TimestampRow label="Verified" value={detail.verifiedAt} /> : null}
            {detail.approvedAt ? <TimestampRow label="Approved" value={detail.approvedAt} /> : null}
            {detail.activatedAt ? <TimestampRow label="Went live" value={detail.activatedAt} /> : null}
            {detail.rejectedAt ? <TimestampRow label="Rejected" value={detail.rejectedAt} /> : null}
            {detail.suspendedAt ? <TimestampRow label="Suspended" value={detail.suspendedAt} /> : null}
          </dl>

          {detail.changeRequestNote ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 caption text-slate-700">
              Outstanding request: {detail.changeRequestNote}
            </p>
          ) : null}
          {detail.rejectionReason ? (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 caption text-slate-700">
              {detail.rejectionReason}
            </p>
          ) : null}
          {detail.suspensionReason ? (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 caption text-slate-700">
              {detail.suspensionReason}
            </p>
          ) : null}

          <p className="mt-4 caption text-slate-500">
            {detail._count.consultations} consultation
            {detail._count.consultations === 1 ? "" : "s"} booked
          </p>
        </div>

        <DashboardSection title="Decisions">
          <PanditDecisionPanel
            action={reviewAction}
            can={can}
            panditProfileId={detail.id}
            status={detail.status}
          />
        </DashboardSection>

        {can.setCommission && commissionAction ? (
          <DashboardSection title="Commission">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <CommissionForm
                action={commissionAction}
                current={detail.commissionPercent}
                panditProfileId={detail.id}
                platformDefault={platformCommission}
              />
            </div>
          </DashboardSection>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="caption text-slate-500">{label}</dt>
      <dd className="body-sm text-slate-800">{value}</dd>
    </div>
  );
}

function TimestampRow({ label, value }: { label: string; value: Date }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="caption text-slate-500">{label}</dt>
      <dd className="caption text-slate-700">
        {value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </dd>
    </div>
  );
}
