import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { getViewer, viewerCanAny } from "@/lib/auth/access";
import { getDashboardMetrics } from "@/lib/admin/dashboard";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Operations" };

function Metric({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <Card className="h-full p-4" variant={href ? "admin-interactive" : "admin"}>
      <p className="caption text-slate-500">{label}</p>
      <p
        className={`mt-1.5 font-display text-3xl leading-none ${
          tone === "danger" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );

  return href ? (
    <Link className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" href={href} prefetch={false}>
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * The operations overview.
 *
 * Reachable by every operator, including a Super Admin. It used to redirect
 * them to /admin/super, which made sense when that was the only super-admin
 * landing - but the sidebar now offers Overview and Super Admin as separate
 * destinations, and the redirect made one of them impossible to open for the
 * single role that sees both. Where sign-in *lands* someone is a different
 * question, and `resolvePostLoginRedirect` still sends a Super Admin to
 * /admin/super.
 */
export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  /**
   * Reaching this page is a coarser question than seeing everything on it.
   *
   * `requireAdmin` admits anyone holding any operations permission, which is
   * correct - an employee given orders needs the order screens. But this page
   * summarises several areas at once, so each section is shown only to someone
   * entitled to that area. Otherwise an employee with tickets alone would read
   * stock levels, order counts and revenue from the landing page.
   */
  const viewer = await getViewer();
  const canSeeOrders = viewerCanAny(viewer, ["orders.view", "orders.manage"]);
  const canSeeStock = viewerCanAny(viewer, [
    "inventory.manage",
    "gemstones.inventory",
    "products.view",
    "products.manage",
  ]);
  const canSeeReports = viewerCanAny(viewer, ["reports.view", "reports.manage"]);
  const canSeeRevenue = viewerCanAny(viewer, ["analytics.view", "payouts.view"]);

  const metrics = await getDashboardMetrics();

  return (
    <AdminLayout adminName={admin.name || admin.email} currentPath="/admin" description="What needs attention right now." title="Operations">
      {canSeeOrders ? (
      <AdminSection description="Physical orders moving through fulfilment." title="Store fulfilment">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric href="/admin/orders?status=PAID" label="Awaiting processing" tone={metrics.ordersAwaitingProcessing > 0 ? "warning" : undefined} value={metrics.ordersAwaitingProcessing} />
          <Metric href="/admin/orders?status=PROCESSING" label="Being prepared" value={metrics.ordersProcessing} />
          <Metric href="/admin/orders?status=SHIPPED" label="In transit" value={metrics.ordersShipped} />
          <Metric label="Paid orders (all time)" value={metrics.paidPhysicalOrders} />
        </div>
      </AdminSection>
      ) : null}

      {canSeeStock ? (
      <AdminSection description={`Low stock means ${metrics.lowStockThreshold} or fewer remaining.`} title="Stock">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric href="/admin/inventory?low=1" label="Low stock" tone={metrics.lowStockCount > 0 ? "warning" : undefined} value={metrics.lowStockCount} />
          <Metric href="/admin/inventory" label="Out of stock" tone={metrics.outOfStockCount > 0 ? "danger" : undefined} value={metrics.outOfStockCount} />
          <Metric href="/admin/products" label="Active products" value={metrics.activeProducts} />
        </div>
      </AdminSection>
      ) : null}

      {canSeeReports ? (
      <AdminSection description="Paid report orders and their generation state." title="Reports">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric href="/admin/report-orders" label="Paid report orders" value={metrics.paidReportOrders} />
          <Metric href="/admin/generated-reports?status=QUEUED" label="Generating" value={metrics.reportsGenerating} />
          <Metric href="/admin/generated-reports?status=READY" label="Delivered" value={metrics.reportsReady} />
          <Metric href="/admin/generated-reports?status=FAILED" label="Failed" tone={metrics.reportFailures > 0 ? "danger" : undefined} value={metrics.reportFailures} />
        </div>
      </AdminSection>
      ) : null}

      {/*
        Revenue is gated, not merely un-linked.

        `requireAdmin()` admits anyone holding any operations permission, which
        by design includes an employee given orders or tickets - they need the
        admin order screens to do their job. But "can work an order" is not
        "may see what the platform earned", and this section was showing
        platform revenue to every such employee. It now needs the permission
        that actually means it.
      */}
      {canSeeRevenue ? (
        <AdminSection description="Summed from captured payments only. Nothing here is estimated or projected." title="Captured payments">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5" variant="admin">
            <div>
              <p className="caption text-slate-500">Total captured</p>
              <p className="mt-1 font-display text-3xl leading-none text-amber-700">
                {formatMoneyMinor(metrics.capturedRevenuePaise, "INR")}
              </p>
            </div>
            <AdminStatusBadge label={`${metrics.activeReportDefinitions} active reports`} tone="info" />
          </Card>
        </AdminSection>
      ) : null}
    </AdminLayout>
  );
}
