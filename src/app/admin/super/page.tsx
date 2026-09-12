import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminSection, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getDashboardMetrics } from "@/lib/admin/dashboard";

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

/**
 * The owner dashboard.
 *
 * Deliberately only what a Super Admin can do that nobody else can: settings,
 * credentials, roles, the audit log. It used to repeat the operational numbers
 * from the Overview page as well, because a Super Admin could not reach
 * Overview - /admin redirected them here. Now that the redirect is gone, that
 * section was showing the same figures from the same query one click away from
 * itself, so it is gone too.
 */
export default async function SuperAdminDashboardPage() {
  const admin = await requireSuperAdmin();

  // Only for the failure count on the report card below. The full operational
  // picture lives on Overview.
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

    </AdminLayout>
  );
}
