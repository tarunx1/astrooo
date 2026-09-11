import type { Metadata } from "next";
import Link from "next/link";
import { PujaBookingStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, FilterBar, MetricCard, MetricGrid, Pagination, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { listPujaBookingsForOperators } from "@/lib/puja/bookings";
import { PUJA_STATUS_LABEL, PUJA_STATUS_TONE } from "@/lib/puja/status";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Puja bookings" };

const PAGE_SIZE = 25;

/**
 * The puja fulfilment queue.
 *
 * Deliberately never selects the Sankalp: an operator triaging the queue does
 * not need a customer's family details, and only the assigned practitioner and
 * the customer themselves can open them.
 */
export default async function AdminPujaBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const viewer = await requirePermission("services.manage");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status && params.status in PujaBookingStatus
      ? (params.status as PujaBookingStatus)
      : undefined;

  const [{ rows, total }, awaiting, scheduled] = await Promise.all([
    listPujaBookingsForOperators({ page, pageSize: PAGE_SIZE, status }),
    prisma.pujaBooking.count({ where: { status: PujaBookingStatus.PANDIT_PENDING } }),
    prisma.pujaBooking.count({ where: { status: PujaBookingStatus.SCHEDULED } }),
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/puja/bookings"
      description="Assign a practitioner, schedule the ritual and record completion."
      title="Puja bookings"
    >
      <MetricGrid>
        <MetricCard
          label="Awaiting assignment"
          tone={awaiting > 0 ? "warning" : undefined}
          value={awaiting}
        />
        <MetricCard label="Scheduled" value={scheduled} />
        <MetricCard label="Total" value={total} />
      </MetricGrid>

      <FilterBar
        basePath="/admin/puja/bookings"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Awaiting assignment", value: PujaBookingStatus.PANDIT_PENDING },
          { label: "Assigned", value: PujaBookingStatus.ASSIGNED },
          { label: "Scheduled", value: PujaBookingStatus.SCHEDULED },
          { label: "Completed", value: PujaBookingStatus.COMPLETED },
          { label: "Cancelled", value: PujaBookingStatus.CANCELLED },
        ]}
      />

      <DataTable
        caption="Puja bookings"
        columns={[
          { key: "booking", label: "Booking" },
          { key: "customer", label: "Customer" },
          { key: "when", label: "Date" },
          { key: "pandit", label: "Practitioner" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
        ]}
        emptyMessage="No bookings match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <Link className="body-sm font-semibold text-blue-700 underline" href={`/admin/puja/bookings/${row.id}`}>
              {row.title}
            </Link>
            <p className="caption font-mono text-slate-400">{row.bookingNumber}</p>
            <p className="caption text-slate-500">{row.customerName}</p>
            <StatusBadge label={PUJA_STATUS_LABEL[row.status]} tone={PUJA_STATUS_TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "booking":
              return (
                <span className="grid">
                  <Link className="font-semibold text-blue-700 underline" href={`/admin/puja/bookings/${row.id}`}>
                    {row.title}
                  </Link>
                  <span className="caption font-mono text-slate-400">{row.bookingNumber}</span>
                </span>
              );
            case "customer":
              return row.customerName;
            case "when":
              return row.scheduledAt
                ? row.scheduledAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : row.requestedDate
                  ? `${row.requestedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (req.)`
                  : "—";
            case "pandit":
              return row.panditName ?? "Unassigned";
            case "amount":
              return formatMoneyMinor(row.pricePaise, row.currency);
            default:
              return <StatusBadge label={PUJA_STATUS_LABEL[row.status]} tone={PUJA_STATUS_TONE[row.status]} />;
          }
        }}
        rows={rows}
      />

      <Pagination
        basePath="/admin/puja/bookings"
        page={page}
        pageSize={PAGE_SIZE}
        query={{ status }}
        total={total}
      />
    </AdminLayout>
  );
}
