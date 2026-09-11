import type { Metadata } from "next";
import { AuditTimeline, DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { OnboardingProgress } from "@/components/pandit/onboarding-progress";
import { requirePandit } from "@/lib/pandit/guard";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/pandit/onboarding";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Verification" };

/**
 * The applicant's own case history.
 *
 * Shows the decisions made on their application and the notes written for
 * them. Internal review notes and the platform audit log are not here: this is
 * the applicant's copy, not the reviewer's.
 */
export default async function PanditVerificationPage() {
  const identity = await requirePandit("/pandit/verification");

  const trail = await prisma.panditReview.findMany({
    where: { panditProfileId: identity.profileId },
    select: { id: true, decision: true, fromStatus: true, toStatus: true, note: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <PanditLayout
      currentPath="/pandit/verification"
      description="Every decision made on your application, newest first."
      eyebrow="Verification"
      identity={identity}
      title="Verification status"
    >
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-4">
          <StatusBadge label={STATUS_LABEL[identity.status]} tone={STATUS_TONE[identity.status]} />
        </div>
        <OnboardingProgress status={identity.status} />
      </div>

      <DashboardSection title="History">
        <AuditTimeline
          entries={trail.map((entry) => ({
            id: entry.id,
            title: STATUS_LABEL[entry.toStatus],
            detail: entry.note,
            at: entry.createdAt,
            tone: STATUS_TONE[entry.toStatus],
          }))}
        />
      </DashboardSection>
    </PanditLayout>
  );
}
