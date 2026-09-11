import type { Metadata } from "next";
import Link from "next/link";
import { EarningStatus, PayoutStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import {
  DashboardSection,
  DataTable,
  EmptyState,
  FilterBar,
  MetricCard,
  MetricGrid,
  StatusBadge,
} from "@/components/dashboard/dashboard-shell";
import { PayoutControls, RaisePayoutForm, ReleaseEarningsForm } from "@/components/admin/payout-forms";
import { requireAnyPermission, viewerCan } from "@/lib/auth/access";
import { formatPaise } from "@/lib/payouts/ledger";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/db/prisma";
import { createPayoutAction, releaseEarningsAction, transitionPayoutAction } from "@/app/admin/payouts/actions";

export const metadata: Metadata = { title: "Payouts" };

const TONE: Record<PayoutStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [PayoutStatus.PENDING]: "warning",
  [PayoutStatus.ELIGIBLE]: "info",
  [PayoutStatus.PROCESSING]: "info",
  [PayoutStatus.PAID]: "positive",
  [PayoutStatus.FAILED]: "danger",
  [PayoutStatus.HELD]: "warning",
};

/**
 * Payouts across the platform.
 *
 * No money moves from here. Marking a payout paid records that an operator made
 * a transfer elsewhere, together with its reference, so the ledger can be
 * reconciled against a bank statement later.
 */
export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const viewer = await requireAnyPermission(["payouts.view", "payouts.process"]);
  const params = await searchParams;

  const status =
    params.status && params.status in PayoutStatus ? (params.status as PayoutStatus) : undefined;

  const canProcess = viewerCan(viewer, "payouts.process");

  const [payouts, owedByPandit, totals, settings] = await Promise.all([
    prisma.payout.findMany({
      where: status ? { status } : {},
      select: {
        id: true,
        payoutNumber: true,
        status: true,
        amountPaise: true,
        periodStart: true,
        periodEnd: true,
        reference: true,
        failureReason: true,
        createdAt: true,
        pandit: { select: { id: true, displayName: true, user: { select: { email: true } } } },
        _count: { select: { earnings: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.earningTransaction.groupBy({
      by: ["panditProfileId"],
      where: { status: EarningStatus.ELIGIBLE, payoutId: null },
      _sum: { netPayablePaise: true },
      _count: { _all: true },
    }),
    prisma.payout.groupBy({ by: ["status"], _sum: { amountPaise: true }, _count: { _all: true } }),
    getSettings(["payouts.cycle", "payouts.minimumPaise", "payouts.holdingPeriodDays"]),
  ]);

  const sum = (target: PayoutStatus) =>
    totals.find((row) => row.status === target)?._sum.amountPaise ?? 0;
  const count = (target: PayoutStatus) => totals.find((row) => row.status === target)?._count._all ?? 0;

  const panditNames = await prisma.panditProfile.findMany({
    where: { id: { in: owedByPandit.map((row) => row.panditProfileId) } },
    select: { id: true, displayName: true, user: { select: { email: true } } },
  });
  const nameById = new Map(panditNames.map((row) => [row.id, row.displayName || row.user.email]));

  const owed = owedByPandit
    .map((row) => ({
      panditProfileId: row.panditProfileId,
      name: nameById.get(row.panditProfileId) ?? "Pandit",
      amountPaise: row._sum.netPayablePaise ?? 0,
      earningCount: row._count._all,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/payouts"
      description={`${settings["payouts.cycle"]} cycle · minimum ${formatPaise(settings["payouts.minimumPaise"])} · ${settings["payouts.holdingPeriodDays"]}-day hold`}
      title="Payouts"
    >
      <MetricGrid>
        <MetricCard label="Eligible, unbatched" value={formatPaise(owed.reduce((t, r) => t + r.amountPaise, 0))} />
        <MetricCard label="Processing" value={formatPaise(sum(PayoutStatus.PROCESSING))} />
        <MetricCard label="Paid" value={formatPaise(sum(PayoutStatus.PAID))} />
        <MetricCard
          label="Failed"
          tone={count(PayoutStatus.FAILED) > 0 ? "danger" : undefined}
          value={count(PayoutStatus.FAILED)}
        />
      </MetricGrid>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="caption text-slate-600">
          No payout provider is connected, so this application does not transfer money. These records track
          what is owed, who released it and which bank reference settled it.
        </p>
      </div>

      {canProcess ? (
        <DashboardSection
          description="Earnings become eligible once their holding period has elapsed."
          title="Maintenance"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <ReleaseEarningsForm action={releaseEarningsAction} />
          </div>
        </DashboardSection>
      ) : null}

      <DashboardSection description="Eligible earnings not yet gathered into a payout." title="Owed now">
        {owed.length === 0 ? (
          <EmptyState description="Nothing is waiting to be paid." title="Nothing outstanding" />
        ) : (
          <DataTable
            caption="Owed"
            columns={[
              { key: "pandit", label: "Pandit" },
              { key: "earnings", label: "Earnings", align: "right" },
              { key: "amount", label: "Amount", align: "right" },
              { key: "action", label: "", align: "right" },
            ]}
            emptyMessage="Nothing outstanding."
            getKey={(row) => row.panditProfileId}
            renderCard={(row) => (
              <div className="grid gap-1.5">
                <p className="body-sm font-semibold text-slate-900">{row.name}</p>
                <p className="caption text-slate-500">
                  {row.earningCount} earnings · {formatPaise(row.amountPaise)}
                </p>
                {canProcess ? (
                  <RaisePayoutForm action={createPayoutAction} panditProfileId={row.panditProfileId} />
                ) : null}
              </div>
            )}
            renderCell={(row, key) => {
              switch (key) {
                case "pandit":
                  return (
                    <Link className="font-semibold text-blue-700 underline" href={`/admin/pandits/${row.panditProfileId}`}>
                      {row.name}
                    </Link>
                  );
                case "earnings":
                  return row.earningCount;
                case "amount":
                  return <span className="font-semibold">{formatPaise(row.amountPaise)}</span>;
                default:
                  return canProcess ? (
                    <RaisePayoutForm action={createPayoutAction} panditProfileId={row.panditProfileId} />
                  ) : null;
              }
            }}
            rows={owed}
          />
        )}
      </DashboardSection>

      <DashboardSection title="Payout batches">
        <FilterBar
          basePath="/admin/payouts"
          current={status}
          options={[
            { label: "All", value: undefined },
            { label: "Eligible", value: PayoutStatus.ELIGIBLE },
            { label: "Processing", value: PayoutStatus.PROCESSING },
            { label: "Paid", value: PayoutStatus.PAID },
            { label: "Failed", value: PayoutStatus.FAILED },
            { label: "Held", value: PayoutStatus.HELD },
          ]}
        />

        <DataTable
          caption="Payouts"
          columns={[
            { key: "payout", label: "Payout" },
            { key: "pandit", label: "Pandit" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "status", label: "Status" },
            { key: "action", label: "", align: "right" },
          ]}
          emptyMessage="No payouts match that filter."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <p className="body-sm font-semibold text-slate-900">{formatPaise(row.amountPaise)}</p>
              <p className="caption font-mono text-slate-400">{row.payoutNumber}</p>
              <p className="caption text-slate-500">{row.pandit.displayName || row.pandit.user.email}</p>
              <StatusBadge label={row.status} tone={TONE[row.status]} />
              {canProcess ? (
                <PayoutControls action={transitionPayoutAction} payoutId={row.id} status={row.status} />
              ) : null}
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "payout":
                return (
                  <span className="grid">
                    <span className="font-mono text-xs">{row.payoutNumber}</span>
                    <span className="caption text-slate-500">{row._count.earnings} earnings</span>
                  </span>
                );
              case "pandit":
                return (
                  <Link className="text-blue-700 underline" href={`/admin/pandits/${row.pandit.id}`}>
                    {row.pandit.displayName || row.pandit.user.email}
                  </Link>
                );
              case "amount":
                return <span className="font-semibold">{formatPaise(row.amountPaise)}</span>;
              case "status":
                return (
                  <span className="grid gap-1">
                    <StatusBadge label={row.status} tone={TONE[row.status]} />
                    {row.reference ? <span className="caption text-slate-500">Ref {row.reference}</span> : null}
                    {row.failureReason ? (
                      <span className="caption text-rose-700">{row.failureReason}</span>
                    ) : null}
                  </span>
                );
              default:
                return canProcess ? (
                  <PayoutControls action={transitionPayoutAction} payoutId={row.id} status={row.status} />
                ) : null;
            }
          }}
          rows={payouts}
        />
      </DashboardSection>
    </AdminLayout>
  );
}
