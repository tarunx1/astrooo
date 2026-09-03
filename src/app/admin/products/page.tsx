import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminPagination, AdminSearch, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";
import { listAdminProducts, type AdminProductRow } from "@/lib/admin/products";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listAdminProducts({ page, pageSize: PAGE_SIZE, search });

  const stockBadge = (row: AdminProductRow) =>
    row.quantity <= 0 ? (
      <AdminStatusBadge label="Out of stock" tone="danger" />
    ) : row.quantity <= 3 ? (
      <AdminStatusBadge label={`Low · ${row.quantity}`} tone="warning" />
    ) : (
      <AdminStatusBadge label={`${row.quantity} in stock`} tone="positive" />
    );

  return (
    <AdminLayout
      actions={
        <Button href="/admin/products/new" size="sm" variant="primary">
          New product
        </Button>
      }
      adminName={admin.name || admin.email}
      currentPath="/admin/products"
      description="Price changes apply to future purchases only."
      title="Products"
    >
      <AdminSearch action="/admin/products" defaultValue={search} placeholder="Search by title, slug or SKU" />

      <AdminTable
        caption="Products"
        columns={[
          { key: "title", label: "Product" },
          { key: "price", label: "Price", align: "right" },
          { key: "stock", label: "Stock" },
          { key: "state", label: "State" },
          { key: "actions", label: "", align: "right" },
        ]}
        emptyMessage="No products match that search."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="body-sm font-semibold text-foreground">{row.title}</p>
                <p className="caption text-foreground-muted">{row.slug}</p>
              </div>
              <p className="shrink-0 body-sm text-foreground">{formatMoneyMinor(row.salePricePaise ?? row.pricePaise)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stockBadge(row)}
              <AdminStatusBadge label={row.active ? "Active" : "Hidden"} tone={row.active ? "positive" : "neutral"} />
            </div>
            <Link className="caption font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/products/${row.id}`} prefetch={false}>
              Manage
            </Link>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "title":
              return (
                <span className="grid">
                  <span className="font-semibold text-foreground">{row.title}</span>
                  <span className="caption text-foreground-muted">
                    {row.slug}
                    {row.variantCount > 0 ? ` · ${row.variantCount} variants` : ""}
                  </span>
                </span>
              );
            case "price":
              return formatMoneyMinor(row.salePricePaise ?? row.pricePaise);
            case "stock":
              return stockBadge(row);
            case "state":
              return <AdminStatusBadge label={row.active ? "Active" : "Hidden"} tone={row.active ? "positive" : "neutral"} />;
            default:
              return (
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/products/${row.id}`} prefetch={false}>
                  Manage
                </Link>
              );
          }
        }}
        rows={rows}
      />

      <AdminPagination basePath="/admin/products" page={page} pageSize={PAGE_SIZE} query={{ q: search }} total={total} />
    </AdminLayout>
  );
}
