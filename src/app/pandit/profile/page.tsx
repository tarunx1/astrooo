import type { Metadata } from "next";
import { PanditOnboardingStatus } from "@prisma/client";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { CompletionMeter } from "@/components/pandit/onboarding-progress";
import { ProfessionalProfileForm, SimpleActionForm } from "@/components/pandit/pandit-forms";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { getCompletion } from "@/lib/pandit/service";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/pandit/onboarding";
import { prisma } from "@/lib/db/prisma";
import { goLiveAction, pauseListingAction, saveProfessionalProfileAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "My profile" };

/**
 * The professional profile.
 *
 * Approval is the platform's decision; being listed is the Pandit's, and it
 * needs a complete profile. The meter and the publish button read from the same
 * completion function, so "100%" and "you may publish" cannot disagree.
 */
export default async function PanditProfilePage() {
  const identity = await requireApprovedPandit("/pandit/profile");

  const [profile, completion] = await Promise.all([
    prisma.panditProfile.findUnique({
      where: { id: identity.profileId },
      select: {
        displayName: true,
        headline: true,
        bio: true,
        profileImageUrl: true,
        city: true,
        state: true,
        yearsOfExperience: true,
        expertise: true,
        languages: true,
        certifications: true,
        slug: true,
      },
    }),
    getCompletion(identity.profileId),
  ]);

  const live = identity.status === PanditOnboardingStatus.ACTIVE;

  return (
    <PanditLayout
      currentPath="/pandit/profile"
      description="What a customer sees before they book you."
      eyebrow="My profile"
      identity={identity}
      title="Professional profile"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DashboardSection title="Your details">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <ProfessionalProfileForm
              action={saveProfessionalProfileAction}
              defaults={{
                displayName: profile?.displayName ?? "",
                headline: profile?.headline ?? "",
                bio: profile?.bio ?? "",
                profileImageUrl: profile?.profileImageUrl ?? "",
                city: profile?.city ?? "",
                state: profile?.state ?? "",
                yearsOfExperience:
                  profile?.yearsOfExperience === null || profile?.yearsOfExperience === undefined
                    ? ""
                    : String(profile.yearsOfExperience),
                expertise: profile?.expertise ?? [],
                languages: profile?.languages ?? [],
                certifications: profile?.certifications ?? [],
              }}
            />
          </div>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-3">
              <StatusBadge label={STATUS_LABEL[identity.status]} tone={STATUS_TONE[identity.status]} />
            </div>
            <CompletionMeter percent={completion.percent} requirements={completion.requirements} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="heading-sm text-slate-900">Listing</h2>
            {live ? (
              <>
                <p className="mt-2 body-sm text-slate-600">
                  You are listed and can be booked. Pausing hides you from search; sessions already booked are
                  unaffected.
                </p>
                {profile?.slug ? (
                  <p className="mt-2 caption text-slate-500">Public handle: {profile.slug}</p>
                ) : null}
                <div className="mt-4">
                  <SimpleActionForm
                    action={pauseListingAction}
                    confirm="Pause your listing? You will stop appearing in search."
                    label="Pause listing"
                    pendingLabel="Pausing..."
                    variant="secondary"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 body-sm text-slate-600">
                  {completion.complete
                    ? "Everything required is in place. Publish when you are ready to take bookings."
                    : "Complete the items listed above, then you can publish."}
                </p>
                <div className="mt-4">
                  <SimpleActionForm action={goLiveAction} label="Go live" pendingLabel="Publishing..." />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PanditLayout>
  );
}
