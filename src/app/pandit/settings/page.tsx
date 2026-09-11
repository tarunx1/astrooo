import type { Metadata } from "next";
import { DashboardSection } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { requirePandit } from "@/lib/pandit/guard";
import { STATUS_LABEL } from "@/lib/pandit/onboarding";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Settings" };

/**
 * Account settings for a Pandit.
 *
 * Read-only for the things a Pandit must not change about themselves - their
 * onboarding status, their commission, their public handle. Those are not
 * merely absent from this page: no action exists that would write them from a
 * Pandit session.
 */
export default async function PanditSettingsPage() {
  const identity = await requirePandit("/pandit/settings");

  const profile = await prisma.panditProfile.findUnique({
    where: { id: identity.profileId },
    select: {
      timezone: true,
      country: true,
      commissionPercent: true,
      slug: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  return (
    <PanditLayout
      currentPath="/pandit/settings"
      description="Your account and the terms your practice runs on."
      eyebrow="Settings"
      identity={identity}
      title="Settings"
    >
      <DashboardSection title="Account">
        <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Name</dt>
            <dd className="body-sm text-slate-800">{profile?.user.name}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Email</dt>
            <dd className="body-sm text-slate-800">{profile?.user.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Timezone</dt>
            <dd className="body-sm text-slate-800">{profile?.timezone}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Applied</dt>
            <dd className="body-sm text-slate-800">
              {profile?.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </DashboardSection>

      <DashboardSection
        description="Set by the platform. Raise a ticket if something here looks wrong."
        title="Your terms"
      >
        <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Onboarding status</dt>
            <dd className="body-sm text-slate-800">{STATUS_LABEL[identity.status]}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Public handle</dt>
            <dd className="body-sm text-slate-800">{profile?.slug ?? "Not issued until you go live"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="caption text-slate-500">Platform commission</dt>
            <dd className="body-sm text-slate-800">
              {profile?.commissionPercent === null || profile?.commissionPercent === undefined
                ? "Platform default"
                : `${profile.commissionPercent}% (agreed rate)`}
            </dd>
          </div>
        </dl>
      </DashboardSection>
    </PanditLayout>
  );
}
