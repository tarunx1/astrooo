import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminPagination, AdminSearch, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { InventoryAdjustForm } from "@/components/admin/inventory-adjust-form";
import { LOW_STOCK_THRESHOLD, listInventory, type InventoryRow } from "@/lib/admin/inventory";
import { requireAnyPermission } from "@/lib/auth/access";

export const metadata: Metadata = { title: "Inventory" };

const PAGE_SIZE = 20;

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; low?: string }>;
}) {
  const admin = await requireAnyPermission(["inventory.manage", "gemstones.inventory"]);
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const onlyLowStock = params.low === "1";

  const { rows, total } = await listInventory({ page, pageSize: PAGE_SIZE, search, onlyLowStock });

  const badge = (row: InventoryRow) =>
    row.quantity <= 0 ? (
      <AdminStatusBadge label="Out of stock" tone="danger" />
    ) : row.isLowStock ? (
      <AdminStatusBadge label="Low" tone="warning" />
    ) : (
      <AdminStatusBadge label="In stock" tone="positive" />
    );

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/inventory"
      description={`Every change is recorded with a reason. Low stock is ${LOW_STOCK_THRESHOLD} or fewer. Stock cannot go below zero.`}
      title="Inventory"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AdminSearch action="/admin/inventory" defaultValue={search} extra={{ low: onlyLowStock ? "1" : undefined }} placeholder="Search by product or SKU" />
        <Link
          className="min-h-10 rounded-md border border-border-strong bg-surface px-3 py-2 text-sm font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          href={onlyLowStock ? "/admin/inventory" : "/admin/inventory?low=1"}
          prefetch={false}
        >
          {onlyLowStock ? "Show all" : "Low stock only"}
        </Link>
      </div>

      <AdminTable
        caption="Inventory"
        columns={[
          { key: "product", label: "Product" },
          { key: "sku", label: "SKU" },
          { key: "quantity", label: "Stock", align: "right" },
          { key: "status", label: "Status" },
          { key: "adjust", label: "Adjust", align: "right" },
        ]}
        emptyMessage="No inventory records match."
        getKey={(row) => row.inventoryId}
        renderCard={(row) => (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="body-sm font-semibold text-foreground">{row.title}</p>
                {row.variantTitle ? <p className="caption text-foreground-muted">{row.variantTitle}</p> : null}
                {row.sku ? <p className="caption text-foreground-muted">{row.sku}</p> : null}
              </div>
              <p className="shrink-0 heading-sm">{row.quantity}</p>
            </div>
            {badge(row)}
            <InventoryAdjustForm productId={row.productId} productVariantId={row.productVariantId} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "product":
              return (
                <span className="grid">
                  <span className="font-semibold text-foreground">{row.title}</span>
                  {row.variantTitle ? <span className="caption text-foreground-muted">{row.variantTitle}</span> : null}
                </span>
              );
            case "sku":
              return row.sku ?? "—";
            case "quantity":
              return <span className="font-semibold text-foreground">{row.quantity}</span>;
            case "status":
              return badge(row);
            default:
              return <InventoryAdjustForm productId={row.productId} productVariantId={row.productVariantId} />;
          }
        }}
        rows={rows}
      />

      <AdminPagination
        basePath="/admin/inventory"
        page={page}
        pageSize={PAGE_SIZE}
        query={{ q: search, low: onlyLowStock ? "1" : undefined }}
        total={total}
      />
    </AdminLayout>
  );
}
