import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getDashboardMetrics } from "@/lib/admin/dashboard";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Super Admin" };

function CommandCard({
  title,
  description,
  href,
  status,
}: {
  title: string;
  description: string;
  href: string;
  status?: string;
}) {
  return (
    <Link
      className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      href={href}
      prefetch={false}
    >
      <Card className="flex h-full flex-col justify-between gap-5 p-5" variant="admin-interactive">
        <div>
          <h2 className="heading-sm text-slate-900">{title}</h2>
          <p className="mt-2 body-sm text-slate-600">{description}</p>
        </div>
        {status ? <AdminStatusBadge label={status} tone="info" /> : null}
      </Card>
    </Link>
  );
}

export default async function SuperAdminDashboardPage() {
  const admin = await requireSuperAdmin();
  const metrics = await getDashboardMetrics();

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/super"
      description="Owner-only command centre for system controls, access and sensitive configuration."
      title="Super Admin"
    >
      <AdminSection description="Only SUPER_ADMIN users can reach this page." title="Control centre">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CommandCard
            description="Edit site identity, provider status, credentials and payment configuration."
            href="/admin/settings"
            status="Owner only"
            title="System settings"
          />
          <CommandCard
            description="Promote, demote or review account roles with audit-backed changes."
            href="/admin/users"
            status="Access control"
            title="Users and roles"
          />
          <CommandCard
            description="Review operator changes, fulfilment events and sensitive admin activity."
            href="/admin/audit"
            status="Immutable log"
            title="Audit log"
          />
          <CommandCard
            description="Check report queues, failures and generated customer deliverables."
            href="/admin/generated-reports"
            status={`${metrics.reportFailures} failures`}
            title="Report generation"
          />
        </div>
      </AdminSection>

      <AdminSection description="High-signal operational numbers, shown here without leaving the owner dashboard." title="Snapshot">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4" variant="admin">
            <p className="caption text-slate-500">Captured revenue</p>
            <p className="mt-1.5 font-display text-3xl leading-none text-amber-700">
              {formatMoneyMinor(metrics.capturedRevenuePaise, "INR")}
            </p>
          </Card>
          <Card className="p-4" variant="admin">
            <p className="caption text-slate-500">Paid orders</p>
            <p className="mt-1.5 font-display text-3xl leading-none text-slate-900">{metrics.paidPhysicalOrders}</p>
          </Card>
          <Card className="p-4" variant="admin">
            <p className="caption text-slate-500">Low stock</p>
            <p className="mt-1.5 font-display text-3xl leading-none text-slate-900">{metrics.lowStockCount}</p>
          </Card>
          <Card className="p-4" variant="admin">
            <p className="caption text-slate-500">Reports ready</p>
            <p className="mt-1.5 font-display text-3xl leading-none text-slate-900">{metrics.reportsReady}</p>
          </Card>
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
