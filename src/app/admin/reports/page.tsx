import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { listReportDefinitions } from "@/lib/admin/catalog-admin";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { requireAnyPermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Report catalogue" };

export default async function AdminReportsPage() {
  const admin = await requireAnyPermission(["reports.view", "reports.manage"]);
  const definitions = await listReportDefinitions();

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/reports"
      description="Editing a report changes future purchases only. Past orders keep the name and price the customer paid."
      title="Report catalogue"
    >
      <AdminTable
        caption="Report definitions"
        columns={[
          { key: "name", label: "Report" },
          { key: "price", label: "Price", align: "right" },
          { key: "orders", label: "Orders", align: "right" },
          { key: "state", label: "State" },
          { key: "actions", label: "", align: "right" },
        ]}
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <p className="body-sm font-semibold text-foreground">{row.name}</p>
            <p className="caption text-foreground-muted">{row.slug}</p>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge label={row.isActive ? "On sale" : "Not on sale"} tone={row.isActive ? "positive" : "neutral"} />
              <AdminStatusBadge label={`${row._count.reportOrders} orders`} tone="neutral" />
            </div>
            <Link className="caption font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/reports/${row.id}`} prefetch={false}>
              Edit
            </Link>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "name":
              return (
                <span className="grid">
                  <span className="font-semibold text-foreground">{row.name}</span>
                  <span className="caption text-foreground-muted">{row.slug}</span>
                </span>
              );
            case "price":
              return formatMoneyMinor(row.priceMinor, row.currency);
            case "orders":
              return row._count.reportOrders;
            case "state":
              return <AdminStatusBadge label={row.isActive ? "On sale" : "Not on sale"} tone={row.isActive ? "positive" : "neutral"} />;
            default:
              return (
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/reports/${row.id}`} prefetch={false}>
                  Edit
                </Link>
              );
          }
        }}
        rows={definitions}
      />
    </AdminLayout>
  );
}
