import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, DataTable, MetricCard, MetricGrid } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { getPlatformAnalytics } from "@/lib/analytics/platform";
import { MODE_LABEL } from "@/lib/pandit/catalog";
import { STATUS_LABEL } from "@/lib/pandit/onboarding";
import { formatPaise } from "@/lib/payouts/ledger";

export const metadata: Metadata = { title: "Analytics" };

/**
 * Platform analytics.
 *
 * Every figure is a count or a sum over rows that exist. Nothing is projected
 * or extrapolated: a metric this application cannot compute is absent rather
 * than estimated, because a plausible-looking wrong number in an operations
 * dashboard is worse than a gap that prompts a question.
 *
 * "Signed in now" is labelled as what it measures - users with an unexpired
 * session - rather than as the vaguer "active users", which would invite a
 * reading the data does not support.
 */
export default async function AdminAnalyticsPage() {
  const viewer = await requirePermission("analytics.view");
  const analytics = await getPlatformAnalytics();

  const panditRows = Object.entries(analytics.pandits)
    .filter(([key]) => key !== "total")
    .map(([status, count]) => ({ status, count: count as number }))
    .filter((row) => row.count > 0);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/analytics"
      description={`Computed from live data at ${analytics.generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}.`}
      title="Analytics"
    >
      <DashboardSection title="Users">
        <MetricGrid>
          <MetricCard label="Total accounts" value={analytics.users.total} />
          <MetricCard label="New this week" value={analytics.users.newThisWeek} />
          <MetricCard label="New this month" value={analytics.users.newThisMonth} />
          <MetricCard
            hint="Unexpired sessions"
            label="Signed in now"
            value={analytics.users.withLiveSession}
          />
        </MetricGrid>
        <MetricGrid>
          <MetricCard label="Customers" value={analytics.users.customers} />
          <MetricCard label="Pandits" value={analytics.users.pandits} />
          <MetricCard label="Employees" value={analytics.users.employees} />
          <MetricCard label="Administrators" value={analytics.users.admins} />
        </MetricGrid>
      </DashboardSection>

      <DashboardSection title="Pandits">
        <MetricGrid>
          <MetricCard label="Total applications" value={analytics.pandits.total} />
          <MetricCard label="Awaiting review" value={analytics.pandits.SUBMITTED} />
          <MetricCard label="Live" value={analytics.pandits.ACTIVE} />
          <MetricCard
            label="Suspended"
            tone={analytics.pandits.SUSPENDED > 0 ? "warning" : undefined}
            value={analytics.pandits.SUSPENDED}
          />
        </MetricGrid>

        {panditRows.length > 0 ? (
          <DataTable
            caption="Pandits by onboarding state"
            columns={[
              { key: "status", label: "Onboarding state" },
              { key: "count", label: "Count", align: "right" },
            ]}
            emptyMessage="No applications yet."
            getKey={(row) => row.status}
            renderCard={(row) => (
              <p className="body-sm text-slate-800">
                {STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]}: {row.count}
              </p>
            )}
            renderCell={(row, key) =>
              key === "status" ? STATUS_LABEL[row.status as keyof typeof STATUS_LABEL] : row.count
            }
            rows={panditRows}
          />
        ) : null}
      </DashboardSection>

      <DashboardSection title="Consultations">
        <MetricGrid>
          <MetricCard label="Scheduled" value={analytics.consultations.scheduled} />
          <MetricCard label="Completed" value={analytics.consultations.completed} />
          <MetricCard label="Cancelled" value={analytics.consultations.cancelled} />
          <MetricCard label="Completed this month" value={analytics.consultations.completedThisMonth} />
        </MetricGrid>
        <MetricGrid>
          {Object.entries(analytics.consultations.byMode).map(([mode, count]) => (
            <MetricCard key={mode} label={MODE_LABEL[mode as keyof typeof MODE_LABEL]} value={count} />
          ))}
          <MetricCard label="No-shows" value={analytics.consultations.noShow} />
        </MetricGrid>
      </DashboardSection>

      <DashboardSection
        description="Consultation revenue comes from the earnings ledger; product and report revenue from paid orders."
        title="Revenue"
      >
        <MetricGrid>
          <MetricCard label="Consultations (gross)" value={formatPaise(analytics.revenue.grossPaise)} />
          <MetricCard
            label="Platform commission"
            value={formatPaise(analytics.revenue.platformCommissionPaise)}
          />
          <MetricCard label="Pandit earnings" value={formatPaise(analytics.revenue.panditEarningsPaise)} />
          <MetricCard label="Product orders" value={formatPaise(analytics.revenue.productRevenuePaise)} />
        </MetricGrid>
        <MetricGrid>
          <MetricCard label="Report orders" value={formatPaise(analytics.revenue.reportRevenuePaise)} />
          <MetricCard label="Pending payout" value={formatPaise(analytics.revenue.pendingPayoutPaise)} />
          <MetricCard label="Paid out" value={formatPaise(analytics.revenue.paidPayoutPaise)} />
          <MetricCard
            label="Failed payouts"
            tone={analytics.revenue.failedPayoutCount > 0 ? "danger" : undefined}
            value={analytics.revenue.failedPayoutCount}
          />
        </MetricGrid>
      </DashboardSection>

      <DashboardSection title="Reports and commerce">
        <MetricGrid>
          <MetricCard label="Report orders" value={analytics.reports.orders} />
          <MetricCard label="Reports ready" value={analytics.reports.ready} />
          <MetricCard
            label="Reports failed"
            tone={analytics.reports.failed > 0 ? "danger" : undefined}
            value={analytics.reports.failed}
          />
          <MetricCard label="Reports in progress" value={analytics.reports.inProgress} />
        </MetricGrid>
        <MetricGrid>
          <MetricCard label="Paid orders" value={analytics.commerce.paidOrders} />
          <MetricCard label="Gemstone orders" value={analytics.commerce.gemstoneOrders} />
          <MetricCard
            label="Low stock"
            tone={analytics.commerce.lowStock > 0 ? "warning" : undefined}
            value={analytics.commerce.lowStock}
          />
          <MetricCard
            label="Out of stock"
            tone={analytics.commerce.outOfStock > 0 ? "danger" : undefined}
            value={analytics.commerce.outOfStock}
          />
        </MetricGrid>
      </DashboardSection>

      <DashboardSection title="Support">
        <MetricGrid>
          <MetricCard label="Open" value={analytics.tickets.OPEN} />
          <MetricCard label="In progress" value={analytics.tickets.IN_PROGRESS} />
          <MetricCard label="Waiting for user" value={analytics.tickets.WAITING_FOR_USER} />
          <MetricCard label="Backlog" tone={analytics.tickets.backlog > 0 ? "warning" : undefined} value={analytics.tickets.backlog} />
        </MetricGrid>
      </DashboardSection>
    </AdminLayout>
  );
}
