import type { Metadata } from "next";
import Link from "next/link";
import { ConsultationStatus, PanditOnboardingStatus, TicketStatus } from "@prisma/client";
import {
  DashboardSection,
  DataTable,
  EmptyState,
  MetricCard,
  MetricGrid,
  StatusBadge,
} from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { CompletionMeter, OnboardingProgress } from "@/components/pandit/onboarding-progress";
import { requirePandit } from "@/lib/pandit/guard";
import { getCompletion } from "@/lib/pandit/service";
import { earningsSummary, formatPaise } from "@/lib/payouts/ledger";
import { isApprovedOrLater, STATUS_LABEL, STATUS_TONE } from "@/lib/pandit/onboarding";
import { MODE_LABEL } from "@/lib/pandit/catalog";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "My practice" };

/**
 * The Pandit home dashboard.
 *
 * Two shapes, chosen by onboarding state. Before approval it is about the
 * application: where it stands, what is outstanding, what a reviewer asked
 * for. After approval it is about the practice. Showing the consultation
 * tiles to an unapproved applicant would be showing them numbers that can only
 * ever be zero.
 */
export default async function PanditDashboardPage() {
  const identity = await requirePandit();
  const approved = isApprovedOrLater(identity.status);

  if (!approved) {
    const [profile, completion, openTickets] = await Promise.all([
      prisma.panditProfile.findUnique({
        where: { id: identity.profileId },
        select: {
          changeRequestNote: true,
          submittedAt: true,
          rejectionReason: true,
          _count: { select: { documents: true } },
        },
      }),
      getCompletion(identity.profileId),
      prisma.ticket.count({
        where: {
          createdById: identity.userId,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER] },
        },
      }),
    ]);

    return (
      <PanditLayout
        currentPath="/pandit"
        description="Your application and what is still needed before you can take consultations."
        eyebrow="My practice"
        identity={identity}
        title={`Welcome, ${identity.displayName || identity.name}`}
      >
        <MetricGrid>
          <MetricCard hint={STATUS_LABEL[identity.status]} label="Application" value="In progress" />
          <MetricCard label="Documents uploaded" value={profile?._count.documents ?? 0} />
          <MetricCard href="/pandit/tickets" label="Open tickets" value={openTickets} />
          <MetricCard
            hint="Consultations open after approval"
            label="Consultations"
            value="Not yet"
          />
        </MetricGrid>

        {profile?.changeRequestNote ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <StatusBadge label="Changes requested" tone="warning" />
            <p className="mt-2 body-sm text-slate-800">{profile.changeRequestNote}</p>
            <Link
              className="mt-3 inline-block text-sm font-semibold text-blue-700 underline"
              href="/pandit/onboarding"
            >
              Update your application
            </Link>
          </div>
        ) : null}

        {identity.status === PanditOnboardingStatus.REJECTED && profile?.rejectionReason ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <StatusBadge label="Not accepted" tone="danger" />
            <p className="mt-2 body-sm text-slate-800">{profile.rejectionReason}</p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardSection description="Where your application stands." title="Onboarding">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <OnboardingProgress status={identity.status} />
              <Link
                className="mt-4 inline-block text-sm font-semibold text-blue-700 underline"
                href="/pandit/onboarding"
              >
                Continue onboarding
              </Link>
            </div>
          </DashboardSection>

          <DashboardSection description="What a complete professional profile needs." title="Readiness">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <CompletionMeter percent={completion.percent} requirements={completion.requirements} />
            </div>
          </DashboardSection>
        </div>
      </PanditLayout>
    );
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60_000);

  const [earnings, completion, upcoming, todayCount, unreadChats, openTickets, scheduleRules] =
    await Promise.all([
      earningsSummary(identity.profileId, now),
      getCompletion(identity.profileId),
      prisma.consultation.findMany({
        where: {
          panditProfileId: identity.profileId,
          status: { in: [ConsultationStatus.REQUESTED, ConsultationStatus.CONFIRMED] },
          scheduledStart: { gte: now },
        },
        select: {
          id: true,
          mode: true,
          status: true,
          scheduledStart: true,
          durationMinutes: true,
          grossAmountPaise: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { scheduledStart: "asc" },
        take: 8,
      }),
      prisma.consultation.count({
        where: {
          panditProfileId: identity.profileId,
          scheduledStart: { gte: startOfDay, lt: endOfDay },
        },
      }),
      prisma.chatMessage.count({
        where: {
          consultation: { panditProfileId: identity.profileId },
          readAt: null,
          NOT: { senderId: identity.userId },
        },
      }),
      prisma.ticket.count({
        where: {
          createdById: identity.userId,
          status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER] },
        },
      }),
      prisma.panditScheduleRule.count({ where: { panditProfileId: identity.profileId } }),
    ]);

  return (
    <PanditLayout
      currentPath="/pandit"
      description="Your consultations, earnings and listing at a glance."
      eyebrow="My practice"
      identity={identity}
      title={`Welcome, ${identity.displayName || identity.name}`}
    >
      <MetricGrid>
        <MetricCard hint="Today" label="Consultations today" value={todayCount} />
        <MetricCard href="/pandit/earnings" label="Earned today" value={formatPaise(earnings.todayPaise)} />
        <MetricCard
          hint="After the holding period"
          href="/pandit/payouts"
          label="Available for payout"
          value={formatPaise(earnings.availablePaise)}
        />
        <MetricCard
          hint="Still inside the holding period"
          label="Pending"
          value={formatPaise(earnings.pendingPaise)}
        />
      </MetricGrid>

      <MetricGrid>
        <MetricCard href="/pandit/chats" label="Unread messages" value={unreadChats} />
        <MetricCard href="/pandit/tickets" label="Open tickets" value={openTickets} />
        <MetricCard
          hint={scheduleRules === 0 ? "No availability set" : undefined}
          href="/pandit/schedule"
          label="Weekly windows"
          tone={scheduleRules === 0 ? "warning" : undefined}
          value={scheduleRules}
        />
        <MetricCard
          hint={STATUS_LABEL[identity.status]}
          href="/pandit/profile"
          label="Listing"
          tone={identity.status === PanditOnboardingStatus.ACTIVE ? undefined : "warning"}
          value={identity.status === PanditOnboardingStatus.ACTIVE ? "Live" : "Not live"}
        />
      </MetricGrid>

      {identity.status !== PanditOnboardingStatus.ACTIVE ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <StatusBadge label={STATUS_LABEL[identity.status]} tone={STATUS_TONE[identity.status]} />
          <p className="mt-2 body-sm text-slate-800">
            You are approved but not yet listed. Complete the items below, then publish your profile.
          </p>
          <div className="mt-3 max-w-md">
            <CompletionMeter percent={completion.percent} requirements={completion.requirements} />
          </div>
          <Link className="mt-3 inline-block text-sm font-semibold text-blue-700 underline" href="/pandit/profile">
            Finish your profile
          </Link>
        </div>
      ) : null}

      <DashboardSection description="The next sessions in your calendar." title="Upcoming consultations">
        {upcoming.length === 0 ? (
          <EmptyState
            description="Bookings will appear here once customers reserve your time."
            title="Nothing booked yet"
          />
        ) : (
          <DataTable
            caption="Upcoming consultations"
            columns={[
              { key: "when", label: "When" },
              { key: "client", label: "Client" },
              { key: "mode", label: "Type" },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            emptyMessage="Nothing booked yet."
            getKey={(row) => row.id}
            renderCard={(row) => (
              <div className="grid gap-1.5">
                <p className="body-sm font-semibold text-slate-900">
                  {row.scheduledStart.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="caption text-slate-500">{row.user.name || row.user.email}</p>
                <p className="caption text-slate-500">
                  {MODE_LABEL[row.mode]} · {row.durationMinutes} min · {formatPaise(row.grossAmountPaise)}
                </p>
              </div>
            )}
            renderCell={(row, key) => {
              switch (key) {
                case "when":
                  return row.scheduledStart.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                case "client":
                  return row.user.name || row.user.email;
                case "mode":
                  return `${MODE_LABEL[row.mode]} · ${row.durationMinutes} min`;
                default:
                  return formatPaise(row.grossAmountPaise);
              }
            }}
            rows={upcoming}
          />
        )}
      </DashboardSection>
    </PanditLayout>
  );
}
