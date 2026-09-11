import type { Metadata } from "next";
import Link from "next/link";
import { InventoryStatus, ProductType } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, MetricCard, MetricGrid, Pagination, SearchBar, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requireAnyPermission, viewerCan } from "@/lib/auth/access";
import { listAdminProducts } from "@/lib/admin/products";
import { formatPaise } from "@/lib/payouts/ledger";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Gemstones" };

const PAGE_SIZE = 25;

const STOCK_TONE: Record<InventoryStatus, "positive" | "warning" | "danger" | "neutral"> = {
  [InventoryStatus.IN_STOCK]: "positive",
  [InventoryStatus.LOW_STOCK]: "warning",
  [InventoryStatus.OUT_OF_STOCK]: "danger",
  [InventoryStatus.PREORDER]: "neutral",
};

/**
 * The gemstone catalogue.
 *
 * Gemstones are products, so stock, orders and fulfilment run through the same
 * machinery as the rest of the shop. This page is the gemstone-shaped view of
 * it, with the stock and sales figures an operator actually asks for.
 */
export default async function AdminGemstonesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const viewer = await requireAnyPermission(["gemstones.view", "gemstones.manage"]);
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const [{ rows, total }, active, lowStock, outOfStock, soldItems] = await Promise.all([
    listAdminProducts({ page, pageSize: PAGE_SIZE, search, type: ProductType.GEMSTONE }),
    prisma.product.count({ where: { type: ProductType.GEMSTONE, active: true } }),
    prisma.inventory.count({
      where: { status: InventoryStatus.LOW_STOCK, product: { type: ProductType.GEMSTONE } },
    }),
    prisma.inventory.count({
      where: { status: InventoryStatus.OUT_OF_STOCK, product: { type: ProductType.GEMSTONE } },
    }),
    prisma.orderItem.aggregate({
      where: { product: { type: ProductType.GEMSTONE }, order: { paidAt: { not: null } } },
      _sum: { totalPaise: true, quantity: true },
    }),
  ]);

  const canManage = viewerCan(viewer, "gemstones.manage");

  return (
    <AdminLayout
      actions={
        canManage ? (
          <Link
            className="min-h-10 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            href="/admin/gemstones/new"
          >
            New gemstone
          </Link>
        ) : null
      }
      adminName={viewer.name || viewer.email}
      currentPath="/admin/gemstones"
      description="Stones, their measured properties, stock and sales."
      title="Gemstones"
    >
      <MetricGrid>
        <MetricCard label="Listed" value={active} />
        <MetricCard label="Low stock" tone={lowStock > 0 ? "warning" : undefined} value={lowStock} />
        <MetricCard label="Out of stock" tone={outOfStock > 0 ? "danger" : undefined} value={outOfStock} />
        <MetricCard
          hint={`${soldItems._sum.quantity ?? 0} stones`}
          label="Sold (paid orders)"
          value={formatPaise(soldItems._sum.totalPaise ?? 0)}
        />
      </MetricGrid>

      <SearchBar action="/admin/gemstones" defaultValue={search} placeholder="Search by title, slug or SKU" />

      <DataTable
        caption="Gemstones"
        columns={[
          { key: "stone", label: "Gemstone" },
          { key: "price", label: "Price", align: "right" },
          { key: "stock", label: "Stock", align: "right" },
          { key: "status", label: "Status" },
        ]}
        emptyMessage="No gemstones yet."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            {canManage ? (
              <Link className="body-sm font-semibold text-blue-700 underline" href={`/admin/gemstones/${row.id}`}>
                {row.title}
              </Link>
            ) : (
              <p className="body-sm font-semibold text-slate-900">{row.title}</p>
            )}
            <p className="caption text-slate-500">{row.sku ?? row.slug}</p>
            <p className="caption text-slate-500">
              {formatPaise(row.salePricePaise ?? row.pricePaise)} · {row.quantity} in stock
            </p>
            <StatusBadge label={row.status} tone={STOCK_TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "stone":
              return (
                <span className="grid">
                  {canManage ? (
                    <Link className="font-semibold text-blue-700 underline" href={`/admin/gemstones/${row.id}`}>
                      {row.title}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-800">{row.title}</span>
                  )}
                  <span className="caption text-slate-500">{row.sku ?? row.slug}</span>
                </span>
              );
            case "price":
              return row.salePricePaise ? (
                <span className="grid">
                  <span className="font-semibold">{formatPaise(row.salePricePaise)}</span>
                  <span className="caption text-slate-400 line-through">{formatPaise(row.pricePaise)}</span>
                </span>
              ) : (
                formatPaise(row.pricePaise)
              );
            case "stock":
              return row.quantity;
            default:
              return (
                <span className="grid gap-1">
                  <StatusBadge label={row.status} tone={STOCK_TONE[row.status]} />
                  <StatusBadge label={row.active ? "Listed" : "Archived"} tone={row.active ? "positive" : "neutral"} />
                </span>
              );
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/admin/gemstones" page={page} pageSize={PAGE_SIZE} query={{ q: search }} total={total} />
    </AdminLayout>
  );
}
