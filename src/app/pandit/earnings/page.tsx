import type { Metadata } from "next";
import { EarningStatus } from "@prisma/client";
import { DashboardSection, DataTable, MetricCard, MetricGrid, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { earningsSummary, formatPaise } from "@/lib/payouts/ledger";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Earnings" };

const TONE: Record<EarningStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [EarningStatus.PENDING]: "warning",
  [EarningStatus.ELIGIBLE]: "info",
  [EarningStatus.PROCESSING]: "info",
  [EarningStatus.PAID]: "positive",
  [EarningStatus.FAILED]: "danger",
  [EarningStatus.HELD]: "warning",
  [EarningStatus.REVERSED]: "neutral",
};

/**
 * The Pandit's own ledger.
 *
 * Every figure is a sum over stored rows scoped to this profile. Nothing is
 * projected, and a period with no work reads zero rather than an estimate.
 */
export default async function PanditEarningsPage() {
  const identity = await requireApprovedPandit("/pandit/earnings");

  const [summary, settings, rows] = await Promise.all([
    earningsSummary(identity.profileId),
    getSettings(["payouts.holdingPeriodDays", "payouts.platformCommissionPercent"]),
    prisma.earningTransaction.findMany({
      where: { panditProfileId: identity.profileId },
      select: {
        id: true,
        status: true,
        grossAmountPaise: true,
        commissionPercent: true,
        platformCommissionPaise: true,
        netPayablePaise: true,
        eligibleAt: true,
        settledAt: true,
        heldReason: true,
        createdAt: true,
        consultation: { select: { mode: true, scheduledStart: true, user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <PanditLayout
      currentPath="/pandit/earnings"
      description={`Earnings become payable ${settings["payouts.holdingPeriodDays"]} days after a consultation completes.`}
      eyebrow="Earnings"
      identity={identity}
      title="Your earnings"
    >
      <MetricGrid>
        <MetricCard label="Today" value={formatPaise(summary.todayPaise)} />
        <MetricCard label="This week" value={formatPaise(summary.weekPaise)} />
        <MetricCard label="This month" value={formatPaise(summary.monthPaise)} />
        <MetricCard label="Total earned" value={formatPaise(summary.totalEarnedPaise)} />
      </MetricGrid>

      <MetricGrid>
        <MetricCard hint="Inside the holding period" label="Pending" value={formatPaise(summary.pendingPaise)} />
        <MetricCard hint="Ready for the next payout" label="Available" value={formatPaise(summary.availablePaise)} />
        <MetricCard label="Paid out" value={formatPaise(summary.paidPaise)} />
        <MetricCard
          hint="Platform share on new work"
          label="Commission"
          value={`${settings["payouts.platformCommissionPercent"]}%`}
        />
      </MetricGrid>

      <DashboardSection description="One line per completed consultation." title="Transactions">
        <DataTable
          caption="Earnings"
          columns={[
            { key: "when", label: "Consultation" },
            { key: "gross", label: "Gross", align: "right" },
            { key: "commission", label: "Platform", align: "right" },
            { key: "net", label: "You receive", align: "right" },
            { key: "status", label: "Status" },
          ]}
          emptyMessage="No earnings yet. Completed consultations appear here."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <p className="body-sm font-semibold text-slate-900">{formatPaise(row.netPayablePaise)}</p>
              <p className="caption text-slate-500">
                {row.consultation?.user.name ?? "Consultation"} ·{" "}
                {row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
              <p className="caption text-slate-500">
                Gross {formatPaise(row.grossAmountPaise)} · platform {row.commissionPercent}%
              </p>
              <StatusBadge label={row.status} tone={TONE[row.status]} />
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "when":
                return (
                  <span className="grid">
                    <span className="font-semibold text-slate-800">
                      {row.consultation?.user.name ?? "Consultation"}
                    </span>
                    <span className="caption text-slate-500">
                      {row.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                );
              case "gross":
                return formatPaise(row.grossAmountPaise);
              case "commission":
                return `${formatPaise(row.platformCommissionPaise)} (${row.commissionPercent}%)`;
              case "net":
                return <span className="font-semibold">{formatPaise(row.netPayablePaise)}</span>;
              default:
                return (
                  <span className="grid gap-1">
                    <StatusBadge label={row.status} tone={TONE[row.status]} />
                    {row.status === EarningStatus.PENDING && row.eligibleAt ? (
                      <span className="caption text-slate-500">
                        Payable {row.eligibleAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    ) : null}
                    {row.heldReason ? <span className="caption text-amber-700">{row.heldReason}</span> : null}
                  </span>
                );
            }
          }}
          rows={rows}
        />
      </DashboardSection>
    </PanditLayout>
  );
}
