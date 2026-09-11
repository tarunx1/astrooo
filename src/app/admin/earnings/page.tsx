import type { Metadata } from "next";
import Link from "next/link";
import { EarningStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, FilterBar, MetricCard, MetricGrid, Pagination, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { HoldEarningForm } from "@/components/admin/payout-forms";
import { requirePermission, viewerCan } from "@/lib/auth/access";
import { formatPaise } from "@/lib/payouts/ledger";
import { prisma } from "@/lib/db/prisma";
import { holdEarningAction } from "@/app/admin/payouts/actions";

export const metadata: Metadata = { title: "Earnings" };

const PAGE_SIZE = 50;

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
 * The platform-wide earnings ledger.
 *
 * One row per settled consultation, each carrying the split it was settled at.
 * Nothing here is recomputed for display, so what an operator sees is what the
 * Pandit is owed.
 */
export default async function AdminEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const viewer = await requirePermission("payouts.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status && params.status in EarningStatus ? (params.status as EarningStatus) : undefined;

  const where = status ? { status } : {};
  const canProcess = viewerCan(viewer, "payouts.process");

  const [rows, total, totals] = await Promise.all([
    prisma.earningTransaction.findMany({
      where,
      select: {
        id: true,
        status: true,
        grossAmountPaise: true,
        commissionPercent: true,
        platformCommissionPaise: true,
        netPayablePaise: true,
        eligibleAt: true,
        heldReason: true,
        payoutId: true,
        createdAt: true,
        pandit: { select: { id: true, displayName: true, user: { select: { email: true } } } },
        consultation: { select: { mode: true, scheduledStart: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.earningTransaction.count({ where }),
    prisma.earningTransaction.aggregate({
      where: { status: { not: EarningStatus.REVERSED } },
      _sum: { grossAmountPaise: true, platformCommissionPaise: true, netPayablePaise: true },
    }),
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/earnings"
      description="Every settled consultation and how it was split."
      title="Earnings ledger"
    >
      <MetricGrid>
        <MetricCard label="Gross consultations" value={formatPaise(totals._sum.grossAmountPaise ?? 0)} />
        <MetricCard label="Platform commission" value={formatPaise(totals._sum.platformCommissionPaise ?? 0)} />
        <MetricCard label="Pandit earnings" value={formatPaise(totals._sum.netPayablePaise ?? 0)} />
        <MetricCard label="Ledger entries" value={total} />
      </MetricGrid>

      <FilterBar
        basePath="/admin/earnings"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Pending", value: EarningStatus.PENDING },
          { label: "Eligible", value: EarningStatus.ELIGIBLE },
          { label: "Processing", value: EarningStatus.PROCESSING },
          { label: "Paid", value: EarningStatus.PAID },
          { label: "Held", value: EarningStatus.HELD },
        ]}
      />

      <DataTable
        caption="Earnings"
        columns={[
          { key: "pandit", label: "Pandit" },
          { key: "gross", label: "Gross", align: "right" },
          { key: "commission", label: "Platform", align: "right" },
          { key: "net", label: "Pandit", align: "right" },
          { key: "status", label: "Status" },
          { key: "action", label: "", align: "right" },
        ]}
        emptyMessage="No earnings match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-slate-900">
              {row.pandit.displayName || row.pandit.user.email}
            </p>
            <p className="caption text-slate-500">
              {formatPaise(row.grossAmountPaise)} gross · {row.commissionPercent}% platform
            </p>
            <p className="body-sm font-semibold text-slate-900">{formatPaise(row.netPayablePaise)}</p>
            <StatusBadge label={row.status} tone={TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "pandit":
              return (
                <span className="grid">
                  <Link className="font-semibold text-blue-700 underline" href={`/admin/pandits/${row.pandit.id}`}>
                    {row.pandit.displayName || "Pandit"}
                  </Link>
                  <span className="caption text-slate-500">
                    {row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
              );
            case "gross":
              return formatPaise(row.grossAmountPaise);
            case "commission":
              return `${formatPaise(row.platformCommissionPaise)} (${row.commissionPercent}%)`;
            case "net":
              return <span className="font-semibold">{formatPaise(row.netPayablePaise)}</span>;
            case "status":
              return (
                <span className="grid gap-1">
                  <StatusBadge label={row.status} tone={TONE[row.status]} />
                  {row.heldReason ? <span className="caption text-amber-700">{row.heldReason}</span> : null}
                </span>
              );
            default:
              return canProcess && !row.payoutId &&
                (row.status === EarningStatus.PENDING ||
                  row.status === EarningStatus.ELIGIBLE ||
                  row.status === EarningStatus.HELD) ? (
                <HoldEarningForm
                  action={holdEarningAction}
                  earningId={row.id}
                  held={row.status === EarningStatus.HELD}
                />
              ) : null;
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/admin/earnings" page={page} pageSize={PAGE_SIZE} query={{ status }} total={total} />
    </AdminLayout>
  );
}
