import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/admin";
import { getDashboardMetrics } from "@/lib/admin/dashboard";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Operations" };

function Metric({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <Card className="h-full p-4" variant={href ? "interactive" : "default"}>
      <p className="caption text-foreground-muted">{label}</p>
      <p
        className={`mt-1.5 font-display text-3xl leading-none ${
          tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </Card>
  );

  return href ? (
    <Link className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan" href={href} prefetch={false}>
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const metrics = await getDashboardMetrics();

  return (
    <AdminLayout adminName={admin.name || admin.email} currentPath="/admin" description="What needs attention right now." title="Operations">
      <AdminSection description="Physical orders moving through fulfilment." title="Store fulfilment">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric href="/admin/orders?status=PAID" label="Awaiting processing" tone={metrics.ordersAwaitingProcessing > 0 ? "warning" : undefined} value={metrics.ordersAwaitingProcessing} />
          <Metric href="/admin/orders?status=PROCESSING" label="Being prepared" value={metrics.ordersProcessing} />
          <Metric href="/admin/orders?status=SHIPPED" label="In transit" value={metrics.ordersShipped} />
          <Metric label="Paid orders (all time)" value={metrics.paidPhysicalOrders} />
        </div>
      </AdminSection>

      <AdminSection description={`Low stock means ${metrics.lowStockThreshold} or fewer remaining.`} title="Stock">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric href="/admin/inventory?low=1" label="Low stock" tone={metrics.lowStockCount > 0 ? "warning" : undefined} value={metrics.lowStockCount} />
          <Metric href="/admin/inventory" label="Out of stock" tone={metrics.outOfStockCount > 0 ? "danger" : undefined} value={metrics.outOfStockCount} />
          <Metric href="/admin/products" label="Active products" value={metrics.activeProducts} />
        </div>
      </AdminSection>

      <AdminSection description="Paid report orders and their generation state." title="Reports">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric href="/admin/report-orders" label="Paid report orders" value={metrics.paidReportOrders} />
          <Metric href="/admin/generated-reports?status=QUEUED" label="Generating" value={metrics.reportsGenerating} />
          <Metric href="/admin/generated-reports?status=READY" label="Delivered" value={metrics.reportsReady} />
          <Metric href="/admin/generated-reports?status=FAILED" label="Failed" tone={metrics.reportFailures > 0 ? "danger" : undefined} value={metrics.reportFailures} />
        </div>
      </AdminSection>

      <AdminSection description="Summed from captured payments only. Nothing here is estimated or projected." title="Captured payments">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="caption text-foreground-muted">Total captured</p>
            <p className="mt-1 font-display text-3xl leading-none text-premium">
              {formatMoneyMinor(metrics.capturedRevenuePaise, "INR")}
            </p>
          </div>
          <AdminStatusBadge label={`${metrics.activeReportDefinitions} active reports`} tone="info" />
        </Card>
      </AdminSection>
    </AdminLayout>
  );
}
