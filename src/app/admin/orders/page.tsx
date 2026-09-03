import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { AdminLayout, AdminPagination, AdminSearch, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { ORDER_STATUS_LABELS } from "@/lib/shop/order-status";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 20;

const TONE: Partial<Record<OrderStatus, "positive" | "warning" | "danger" | "info" | "neutral">> = {
  PAID: "warning",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "positive",
  CANCELLED: "danger",
  PENDING_PAYMENT: "neutral",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const status = Object.values(OrderStatus).includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : undefined;

  const where = {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: "insensitive" as const } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  // Selects only list columns: no payment payloads, no address JSON.
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/orders"
      description="Fulfilment only. Payment status comes from verified payment processing and cannot be set here."
      title="Orders"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AdminSearch action="/admin/orders" defaultValue={search} extra={{ status }} placeholder="Search order number or email" />
        <div className="flex flex-wrap gap-2">
          {[undefined, OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED].map((value) => (
            <Link
              className={`min-h-9 rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan ${
                status === value ? "border-primary bg-surface-raised text-foreground" : "border-border bg-surface text-foreground-muted"
              }`}
              href={value ? `/admin/orders?status=${value}` : "/admin/orders"}
              key={value ?? "all"}
              prefetch={false}
            >
              {value ? ORDER_STATUS_LABELS[value] : "All"}
            </Link>
          ))}
        </div>
      </div>

      <AdminTable
        caption="Orders"
        columns={[
          { key: "number", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "date", label: "Placed" },
          { key: "total", label: "Total", align: "right" },
          { key: "status", label: "Status" },
          { key: "actions", label: "", align: "right" },
        ]}
        emptyMessage="No orders match."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="body-sm font-semibold text-foreground">{row.orderNumber}</p>
              <p className="body-sm text-foreground">{formatMoneyMinor(row.totalPaise, row.currency)}</p>
            </div>
            <p className="caption text-foreground-muted">{row.user.email}</p>
            <AdminStatusBadge label={ORDER_STATUS_LABELS[row.status]} tone={TONE[row.status] ?? "neutral"} />
            <Link className="caption font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/orders/${row.id}`} prefetch={false}>
              Open
            </Link>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "number":
              return <span className="font-semibold text-foreground">{row.orderNumber}</span>;
            case "customer":
              return row.user.email;
            case "date":
              return row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            case "total":
              return formatMoneyMinor(row.totalPaise, row.currency);
            case "status":
              return <AdminStatusBadge label={ORDER_STATUS_LABELS[row.status]} tone={TONE[row.status] ?? "neutral"} />;
            default:
              return (
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/admin/orders/${row.id}`} prefetch={false}>
                  Open
                </Link>
              );
          }
        }}
        rows={rows}
      />

      <AdminPagination basePath="/admin/orders" page={page} pageSize={PAGE_SIZE} query={{ q: search, status }} total={total} />
    </AdminLayout>
  );
}
