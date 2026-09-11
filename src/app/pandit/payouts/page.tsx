import type { Metadata } from "next";
import { PayoutStatus } from "@prisma/client";
import { DashboardSection, DataTable, EmptyState, MetricCard, MetricGrid, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { PayoutAccountForm } from "@/components/pandit/pandit-forms";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { earningsSummary, formatPaise } from "@/lib/payouts/ledger";
import { getPayoutAccountView } from "@/lib/payouts/account";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/db/prisma";
import { savePayoutAccountAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Payouts" };

const TONE: Record<PayoutStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [PayoutStatus.PENDING]: "warning",
  [PayoutStatus.ELIGIBLE]: "info",
  [PayoutStatus.PROCESSING]: "info",
  [PayoutStatus.PAID]: "positive",
  [PayoutStatus.FAILED]: "danger",
  [PayoutStatus.HELD]: "warning",
};

const CYCLE_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
  MANUAL: "On request",
};

/**
 * Payout destination and history.
 *
 * The destination is shown masked and cannot be revealed: the plaintext is
 * encrypted at rest and there is no read path in this application that returns
 * it, to the Pandit or to an operator. Changing it means entering it again.
 */
export default async function PanditPayoutsPage() {
  const identity = await requireApprovedPandit("/pandit/payouts");

  const [summary, account, settings, payouts, holder] = await Promise.all([
    earningsSummary(identity.profileId),
    getPayoutAccountView(identity.profileId),
    getSettings(["payouts.cycle", "payouts.minimumPaise", "payouts.holdingPeriodDays", "payouts.automatic"]),
    prisma.payout.findMany({
      where: { panditProfileId: identity.profileId },
      select: {
        id: true,
        payoutNumber: true,
        status: true,
        amountPaise: true,
        periodStart: true,
        periodEnd: true,
        processedAt: true,
        reference: true,
        failureReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.panditProfile.findUnique({ where: { id: identity.profileId }, select: { displayName: true } }),
  ]);

  return (
    <PanditLayout
      currentPath="/pandit/payouts"
      description={`${CYCLE_LABEL[settings["payouts.cycle"]] ?? settings["payouts.cycle"]} payouts, minimum ${formatPaise(settings["payouts.minimumPaise"])}.`}
      eyebrow="Payouts"
      identity={identity}
      title="Payouts"
    >
      <MetricGrid>
        <MetricCard hint="Ready to be paid" label="Available" value={formatPaise(summary.availablePaise)} />
        <MetricCard hint="Inside the holding period" label="Pending" value={formatPaise(summary.pendingPaise)} />
        <MetricCard label="Paid to date" value={formatPaise(summary.paidPaise)} />
        <MetricCard
          hint={account ? "On file" : "Needed before you can be paid"}
          label="Payout account"
          tone={account ? undefined : "warning"}
          value={account ? "Set" : "Missing"}
        />
      </MetricGrid>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DashboardSection description="Each batch and how it was transferred." title="Payout history">
          {payouts.length === 0 ? (
            <EmptyState
              description="Once your available balance passes the minimum, a payout is raised for it."
              title="No payouts yet"
            />
          ) : (
            <DataTable
              caption="Payouts"
              columns={[
                { key: "number", label: "Payout" },
                { key: "period", label: "Period" },
                { key: "amount", label: "Amount", align: "right" },
                { key: "status", label: "Status" },
              ]}
              emptyMessage="No payouts yet."
              getKey={(row) => row.id}
              renderCard={(row) => (
                <div className="grid gap-1.5">
                  <p className="body-sm font-semibold text-slate-900">{formatPaise(row.amountPaise)}</p>
                  <p className="caption text-slate-500">{row.payoutNumber}</p>
                  <StatusBadge label={row.status} tone={TONE[row.status]} />
                  {row.reference ? <p className="caption text-slate-500">Ref {row.reference}</p> : null}
                </div>
              )}
              renderCell={(row, key) => {
                switch (key) {
                  case "number":
                    return <span className="font-mono text-xs">{row.payoutNumber}</span>;
                  case "period":
                    return `${row.periodStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${row.periodEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
                  case "amount":
                    return <span className="font-semibold">{formatPaise(row.amountPaise)}</span>;
                  default:
                    return (
                      <span className="grid gap-1">
                        <StatusBadge label={row.status} tone={TONE[row.status]} />
                        {row.reference ? (
                          <span className="caption text-slate-500">Ref {row.reference}</span>
                        ) : null}
                        {row.failureReason ? (
                          <span className="caption text-rose-700">{row.failureReason}</span>
                        ) : null}
                      </span>
                    );
                }
              }}
              rows={payouts}
            />
          )}
        </DashboardSection>

        <div className="grid gap-4 self-start">
          {account ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <h2 className="heading-sm text-slate-900">Where you are paid</h2>
              <dl className="mt-3 grid gap-2">
                <div className="flex justify-between gap-3">
                  <dt className="caption text-slate-500">Account holder</dt>
                  <dd className="body-sm text-slate-800">{account.accountHolderName}</dd>
                </div>
                {account.bankName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="caption text-slate-500">Bank</dt>
                    <dd className="body-sm text-slate-800">{account.bankName}</dd>
                  </div>
                ) : null}
                {account.accountLast4 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="caption text-slate-500">Account</dt>
                    <dd className="body-sm font-mono text-slate-800">******{account.accountLast4}</dd>
                  </div>
                ) : null}
                {account.ifscMasked ? (
                  <div className="flex justify-between gap-3">
                    <dt className="caption text-slate-500">IFSC</dt>
                    <dd className="body-sm font-mono text-slate-800">{account.ifscMasked}</dd>
                  </div>
                ) : null}
                {account.upiMasked ? (
                  <div className="flex justify-between gap-3">
                    <dt className="caption text-slate-500">UPI</dt>
                    <dd className="body-sm font-mono text-slate-800">{account.upiMasked}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="mt-3 caption text-slate-500">
                These cannot be shown in full again. To change them, enter the new details below.
              </p>
            </div>
          ) : null}

          <DashboardSection title={account ? "Replace payout details" : "Add payout details"}>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <PayoutAccountForm
                action={savePayoutAccountAction}
                holderName={account?.accountHolderName ?? holder?.displayName ?? ""}
              />
            </div>
          </DashboardSection>

          {!settings["payouts.automatic"] ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="caption text-slate-600">
                Transfers are made by the platform team, not automatically: no payout provider is connected yet.
                Your balance, eligibility and history here are real records of what is owed.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </PanditLayout>
  );
}
