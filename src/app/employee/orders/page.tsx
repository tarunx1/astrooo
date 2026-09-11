import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { DataTable, FilterBar, Pagination, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requireAnyPermission, viewerCan } from "@/lib/auth/access";
import { formatPaise } from "@/lib/payouts/ledger";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Orders" };

const PAGE_SIZE = 25;

/**
 * Orders an employee may work on.
 *
 * Read-only unless they also hold `orders.manage`, in which case the link takes
 * them to the admin order screen where fulfilment happens - there is one order
 * workflow, not an employee copy of it.
 */
export default async function EmployeeOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const viewer = await requireAnyPermission(["orders.view", "orders.manage"]);
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status && params.status in OrderStatus ? (params.status as OrderStatus) : undefined;

  const where = status ? { status } : { status: { in: [OrderStatus.PAID, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);

  const canManage = viewerCan(viewer, "orders.manage");

  return (
    <EmployeeLayout
      currentPath="/employee/orders"
      description={canManage ? "Orders awaiting fulfilment." : "Read-only. Ask for orders.manage to advance fulfilment."}
      eyebrow="Commerce"
      title="Orders"
    >
      <FilterBar
        basePath="/employee/orders"
        current={status}
        options={[
          { label: "Needs attention", value: undefined },
          { label: "Paid", value: OrderStatus.PAID },
          { label: "Processing", value: OrderStatus.PROCESSING },
          { label: "Shipped", value: OrderStatus.SHIPPED },
          { label: "Delivered", value: OrderStatus.DELIVERED },
        ]}
      />

      <DataTable
        caption="Orders"
        columns={[
          { key: "order", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "items", label: "Items", align: "right" },
          { key: "total", label: "Total", align: "right" },
          { key: "status", label: "Status" },
        ]}
        emptyMessage="No orders match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            {canManage ? (
              <Link className="body-sm font-semibold text-blue-700 underline" href={`/admin/orders/${row.id}`}>
                {row.orderNumber}
              </Link>
            ) : (
              <p className="body-sm font-semibold text-slate-900">{row.orderNumber}</p>
            )}
            <p className="caption text-slate-500">{row.user.name || row.user.email}</p>
            <StatusBadge label={row.status} tone="neutral" />
            <p className="caption text-slate-500">{formatPaise(row.totalPaise)}</p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "order":
              return canManage ? (
                <Link className="font-mono text-xs font-semibold text-blue-700 underline" href={`/admin/orders/${row.id}`}>
                  {row.orderNumber}
                </Link>
              ) : (
                <span className="font-mono text-xs">{row.orderNumber}</span>
              );
            case "customer":
              return row.user.name || row.user.email;
            case "items":
              return row._count.items;
            case "total":
              return formatPaise(row.totalPaise);
            default:
              return <StatusBadge label={row.status} tone="neutral" />;
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/employee/orders" page={page} pageSize={PAGE_SIZE} query={{ status }} total={total} />
    </EmployeeLayout>
  );
}
