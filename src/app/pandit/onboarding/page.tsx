import type { Metadata } from "next";
import { PanditDocumentStatus } from "@prisma/client";
import { DashboardSection, EmptyState, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { OnboardingProgress } from "@/components/pandit/onboarding-progress";
import { BasicDetailsForm, DocumentUploadForm, SimpleActionForm } from "@/components/pandit/pandit-forms";
import { requirePandit } from "@/lib/pandit/guard";
import { canSubmitApplication } from "@/lib/pandit/service";
import { listDocuments } from "@/lib/pandit/documents";
import { DOCUMENT_TYPE_LABEL, REQUIRED_DOCUMENT_TYPES } from "@/lib/pandit/catalog";
import { STATUS_LABEL, STATUS_TONE, isEditableByPandit } from "@/lib/pandit/onboarding";
import { prisma } from "@/lib/db/prisma";
import {
  deleteDocumentAction,
  saveBasicDetailsAction,
  submitApplicationAction,
  uploadDocumentAction,
} from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Onboarding" };

const DOCUMENT_STATUS_TONE = {
  [PanditDocumentStatus.PENDING]: "warning",
  [PanditDocumentStatus.ACCEPTED]: "positive",
  [PanditDocumentStatus.REJECTED]: "danger",
} as const;

/**
 * The applicant's own onboarding page.
 *
 * Editable only in the states the machine says are the applicant's to edit.
 * Once it is with a reviewer the forms are replaced by a notice, so nobody is
 * invited to change an application that is being read - and the actions refuse
 * it independently in any case.
 */
export default async function PanditOnboardingPage() {
  const identity = await requirePandit("/pandit/onboarding");

  const [profile, documents, readiness] = await Promise.all([
    prisma.panditProfile.findUnique({
      where: { id: identity.profileId },
      select: {
        displayName: true,
        phone: true,
        city: true,
        state: true,
        yearsOfExperience: true,
        expertise: true,
        languages: true,
        changeRequestNote: true,
      },
    }),
    listDocuments(identity.profileId),
    canSubmitApplication(identity.profileId),
  ]);

  const editable = isEditableByPandit(identity.status);

  return (
    <PanditLayout
      currentPath="/pandit/onboarding"
      description="Tell us who you are and upload what we need to verify you."
      eyebrow="Onboarding"
      identity={identity}
      title="Your application"
    >
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge label={STATUS_LABEL[identity.status]} tone={STATUS_TONE[identity.status]} />
        </div>
        <OnboardingProgress status={identity.status} />
      </div>

      {profile?.changeRequestNote ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <StatusBadge label="A reviewer asked for changes" tone="warning" />
          <p className="mt-2 body-sm text-slate-800">{profile.changeRequestNote}</p>
        </div>
      ) : null}

      {!editable ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="body-sm text-slate-800">
            Your application is with a reviewer, so it is locked while they read it. If something needs
            correcting they will send it back to you with a note.
          </p>
        </div>
      ) : null}

      {editable ? (
        <DashboardSection
          description="The reviewer reads these alongside your documents."
          title="Your details"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <BasicDetailsForm
              action={saveBasicDetailsAction}
              defaults={{
                displayName: profile?.displayName ?? "",
                phone: profile?.phone ?? "",
                city: profile?.city ?? "",
                state: profile?.state ?? "",
                yearsOfExperience:
                  profile?.yearsOfExperience === null || profile?.yearsOfExperience === undefined
                    ? ""
                    : String(profile.yearsOfExperience),
                expertise: profile?.expertise ?? [],
                languages: profile?.languages ?? [],
              }}
            />
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection
        description={`Required: ${REQUIRED_DOCUMENT_TYPES.map((type) => DOCUMENT_TYPE_LABEL[type]).join(", ")}. Stored privately; only you and a reviewer can open them.`}
        title="Verification documents"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {editable ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <DocumentUploadForm action={uploadDocumentAction} />
            </div>
          ) : null}

          <div className="grid gap-3">
            {documents.length === 0 ? (
              <EmptyState
                description="Upload your identity document to continue."
                title="Nothing uploaded yet"
              />
            ) : (
              documents.map((document) => (
                <div
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
                  key={document.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="body-sm font-semibold text-slate-900">
                        {DOCUMENT_TYPE_LABEL[document.type]}
                      </p>
                      <p className="caption text-slate-500">
                        {document.fileName} · {(document.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <StatusBadge
                      label={document.status}
                      tone={DOCUMENT_STATUS_TONE[document.status]}
                    />
                  </div>

                  {document.rejectionReason ? (
                    <p className="mt-2 body-sm text-rose-700">{document.rejectionReason}</p>
                  ) : null}

                  {editable && document.status === PanditDocumentStatus.PENDING ? (
                    <div className="mt-3">
                      <SimpleActionForm
                        action={deleteDocumentAction}
                        confirm="Remove this document?"
                        hidden={{ documentId: document.id }}
                        label="Remove"
                        pendingLabel="Removing..."
                        variant="secondary"
                      />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </DashboardSection>

      {editable ? (
        <DashboardSection
          description="A reviewer will read your application and either verify it or send it back with notes."
          title="Submit for review"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            {readiness.ok ? (
              <SimpleActionForm
                action={submitApplicationAction}
                label="Submit for review"
                pendingLabel="Submitting..."
              />
            ) : (
              <>
                <p className="body-sm text-slate-700">Still needed before you can submit:</p>
                <ul className="mt-2 grid gap-1">
                  {readiness.missing.map((item) => (
                    <li className="caption text-slate-600" key={item}>
                      · {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </DashboardSection>
      ) : null}
    </PanditLayout>
  );
}
