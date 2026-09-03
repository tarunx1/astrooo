import type { Metadata } from "next";
import { AdminLayout, AdminPagination, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import { listReportOrders } from "@/lib/admin/catalog-admin";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Report orders" };

const PAGE_SIZE = 25;

export default async function AdminReportOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { rows, total } = await listReportOrders({ page, pageSize: PAGE_SIZE });

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/report-orders"
      description="Read-only. Payment state comes from verified payment processing and cannot be edited."
      title="Report orders"
    >
      <AdminTable
        caption="Report orders"
        columns={[
          { key: "report", label: "Report" },
          { key: "customer", label: "Customer" },
          { key: "paid", label: "Paid" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "generation", label: "Generation" },
        ]}
        emptyMessage="No report orders yet."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-foreground">{row.reportNameSnapshot}</p>
            <p className="caption text-foreground-muted">{row.user.email}</p>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge label={row.status} tone={row.paidAt ? "positive" : "neutral"} />
              {row.generatedReport ? <AdminStatusBadge label={row.generatedReport.status} tone="info" /> : null}
            </div>
            <p className="caption text-foreground-muted">{formatMoneyMinor(row.priceMinor, row.currency)}</p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "report":
              return <span className="font-semibold text-foreground">{row.reportNameSnapshot}</span>;
            case "customer":
              return row.user.email;
            case "paid":
              return row.paidAt
                ? row.paidAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "Not paid";
            case "amount":
              return formatMoneyMinor(row.priceMinor, row.currency);
            default:
              return row.generatedReport ? (
                <AdminStatusBadge
                  label={`${row.generatedReport.status} · ${row.generatedReport.attemptCount} attempts`}
                  tone={row.generatedReport.status === "FAILED" ? "danger" : "info"}
                />
              ) : (
                <AdminStatusBadge label="Not queued" tone="neutral" />
              );
          }
        }}
        rows={rows}
      />

      <AdminPagination basePath="/admin/report-orders" page={page} pageSize={PAGE_SIZE} total={total} />
    </AdminLayout>
  );
}
