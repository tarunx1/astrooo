import type { Metadata } from "next";
import Link from "next/link";
import { ConsultationStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, FilterBar, MetricCard, MetricGrid, Pagination, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { MODE_LABEL } from "@/lib/pandit/catalog";
import { formatPaise } from "@/lib/payouts/ledger";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Consultations" };

const PAGE_SIZE = 50;

const TONE: Record<ConsultationStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [ConsultationStatus.REQUESTED]: "warning",
  [ConsultationStatus.CONFIRMED]: "info",
  [ConsultationStatus.IN_PROGRESS]: "info",
  [ConsultationStatus.COMPLETED]: "positive",
  [ConsultationStatus.CANCELLED]: "neutral",
  [ConsultationStatus.NO_SHOW]: "danger",
};

/**
 * Consultations across the platform.
 *
 * Read-only. Operators can see what was booked and whether it settled; the
 * conversation inside a consultation is not here, because being able to
 * administer a booking is not the same as being party to it.
 */
export default async function AdminConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const viewer = await requirePermission("consultations.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const status =
    params.status && params.status in ConsultationStatus
      ? (params.status as ConsultationStatus)
      : undefined;

  const where = status ? { status } : {};
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [rows, total, today, completed, cancelled] = await Promise.all([
    prisma.consultation.findMany({
      where,
      select: {
        id: true,
        mode: true,
        status: true,
        scheduledStart: true,
        durationMinutes: true,
        grossAmountPaise: true,
        user: { select: { name: true, email: true } },
        pandit: { select: { id: true, displayName: true } },
        earning: { select: { id: true, status: true } },
      },
      orderBy: { scheduledStart: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.consultation.count({ where }),
    prisma.consultation.count({
      where: { scheduledStart: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 86_400_000) } },
    }),
    prisma.consultation.count({ where: { status: ConsultationStatus.COMPLETED } }),
    prisma.consultation.count({ where: { status: ConsultationStatus.CANCELLED } }),
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/consultations"
      description="Every booked session. Conversations between a customer and a Pandit are private to them."
      title="Consultations"
    >
      <MetricGrid>
        <MetricCard label="Today" value={today} />
        <MetricCard label="Completed" value={completed} />
        <MetricCard label="Cancelled" value={cancelled} />
        <MetricCard label="Total" value={total} />
      </MetricGrid>

      <FilterBar
        basePath="/admin/consultations"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Requested", value: ConsultationStatus.REQUESTED },
          { label: "Confirmed", value: ConsultationStatus.CONFIRMED },
          { label: "Completed", value: ConsultationStatus.COMPLETED },
          { label: "Cancelled", value: ConsultationStatus.CANCELLED },
          { label: "No show", value: ConsultationStatus.NO_SHOW },
        ]}
      />

      <DataTable
        caption="Consultations"
        columns={[
          { key: "when", label: "When" },
          { key: "pandit", label: "Pandit" },
          { key: "client", label: "Client" },
          { key: "mode", label: "Type" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "status", label: "Status" },
        ]}
        emptyMessage="No consultations match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-slate-900">
              {row.scheduledStart.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="caption text-slate-500">
              {row.pandit.displayName} · {row.user.name || row.user.email}
            </p>
            <StatusBadge label={row.status} tone={TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "when":
              return row.scheduledStart.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
            case "pandit":
              return (
                <Link className="text-blue-700 underline" href={`/admin/pandits/${row.pandit.id}`}>
                  {row.pandit.displayName}
                </Link>
              );
            case "client":
              return row.user.name || row.user.email;
            case "mode":
              return `${MODE_LABEL[row.mode]} · ${row.durationMinutes} min`;
            case "amount":
              return formatPaise(row.grossAmountPaise);
            default:
              return (
                <span className="grid gap-1">
                  <StatusBadge label={row.status} tone={TONE[row.status]} />
                  {row.earning ? (
                    <span className="caption text-slate-500">Settled: {row.earning.status}</span>
                  ) : null}
                </span>
              );
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/admin/consultations" page={page} pageSize={PAGE_SIZE} query={{ status }} total={total} />
    </AdminLayout>
  );
}
