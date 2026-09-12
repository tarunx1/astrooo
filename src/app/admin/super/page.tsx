import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { getSuperAdminDashboardData } from "@/lib/admin/super-dashboard";

export const metadata: Metadata = { title: "Super Admin" };

/**
 * The owner dashboard.
 *
 * This remains a Super Admin-only route. The presentation mirrors the supplied
 * analytics reference, while every displayed measure is computed from a real
 * application record rather than approximated web telemetry.
 */
export default async function SuperAdminDashboardPage() {
  const admin = await requireSuperAdmin();
  const data = await getSuperAdminDashboardData();

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      contentMode="workspace"
      currentPath="/admin/super"
      title="Super Admin"
    >
      <SuperAdminDashboard adminName={admin.name || admin.email} data={data} />
    </AdminLayout>
  );
}
