import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { listCoupons } from "@/lib/admin/catalog-admin";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { requirePermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  const admin = await requirePermission("coupons.manage");
  const coupons = await listCoupons();

  return (
    <AdminLayout
      actions={
        <Button href="/admin/coupons/new" size="sm" variant="primary">
          New coupon
        </Button>
      }
      adminName={admin.name || admin.email}
      currentPath="/admin/coupons"
      description="Deactivating a coupon stops future use. Past orders keep their recorded discount."
      title="Coupons"
    >
      <AdminTable
        caption="Coupons"
        columns={[
          { key: "code", label: "Code" },
          { key: "value", label: "Discount" },
          { key: "used", label: "Used", align: "right" },
          { key: "state", label: "State" },
          { key: "actions", label: "", align: "right" },
        ]}
        emptyMessage="No coupons yet."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <p className="body-sm font-semibold text-foreground">{row.code}</p>
            <p className="caption text-foreground-muted">
              {row.percentOff ? `${row.percentOff}% off` : row.amountOffPaise ? `${formatMoneyMinor(row.amountOffPaise)} off` : "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge label={row.active ? "Active" : "Inactive"} tone={row.active ? "positive" : "neutral"} />
              <AdminStatusBadge label={`${row.timesRedeemed} used`} tone="neutral" />
            </div>
            <Link className="caption font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/coupons/${row.id}`} prefetch={false}>
              Edit
            </Link>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "code":
              return <span className="font-semibold text-foreground">{row.code}</span>;
            case "value":
              return row.percentOff
                ? `${row.percentOff}%${row.maxDiscountPaise ? ` (max ${formatMoneyMinor(row.maxDiscountPaise)})` : ""}`
                : row.amountOffPaise
                  ? formatMoneyMinor(row.amountOffPaise)
                  : "—";
            case "used":
              return `${row.timesRedeemed}${row.usageLimit ? ` / ${row.usageLimit}` : ""}`;
            case "state":
              return <AdminStatusBadge label={row.active ? "Active" : "Inactive"} tone={row.active ? "positive" : "neutral"} />;
            default:
              return (
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/coupons/${row.id}`} prefetch={false}>
                  Edit
                </Link>
              );
          }
        }}
        rows={coupons}
      />
    </AdminLayout>
  );
}
