import type { Metadata } from "next";
import Link from "next/link";
import { ConsultationStatus } from "@prisma/client";
import { DataTable, FilterBar, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { SimpleActionForm } from "@/components/pandit/pandit-forms";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { MODE_LABEL } from "@/lib/pandit/catalog";
import { formatPaise } from "@/lib/payouts/ledger";
import { prisma } from "@/lib/db/prisma";
import { completeConsultationAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Consultations" };

const TONE: Record<ConsultationStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [ConsultationStatus.REQUESTED]: "warning",
  [ConsultationStatus.CONFIRMED]: "info",
  [ConsultationStatus.IN_PROGRESS]: "info",
  [ConsultationStatus.COMPLETED]: "positive",
  [ConsultationStatus.CANCELLED]: "neutral",
  [ConsultationStatus.NO_SHOW]: "danger",
};

/**
 * The Pandit's own consultations.
 *
 * Scoped by `panditProfileId` in the query, so another Pandit's sessions are
 * not something this page has to remember to exclude.
 */
export default async function PanditConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const identity = await requireApprovedPandit("/pandit/consultations");
  const params = await searchParams;

  const status =
    params.status && params.status in ConsultationStatus
      ? (params.status as ConsultationStatus)
      : undefined;

  const rows = await prisma.consultation.findMany({
    where: { panditProfileId: identity.profileId, ...(status ? { status } : {}) },
    select: {
      id: true,
      mode: true,
      status: true,
      scheduledStart: true,
      durationMinutes: true,
      grossAmountPaise: true,
      user: { select: { name: true, email: true } },
      earning: { select: { id: true, netPayablePaise: true } },
      _count: { select: { kundliAccess: true } },
    },
    orderBy: { scheduledStart: "desc" },
    take: 100,
  });

  return (
    <PanditLayout
      currentPath="/pandit/consultations"
      description="Sessions booked with you, newest first."
      eyebrow="Consultations"
      identity={identity}
      title="Your consultations"
    >
      <FilterBar
        basePath="/pandit/consultations"
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Requested", value: ConsultationStatus.REQUESTED },
          { label: "Confirmed", value: ConsultationStatus.CONFIRMED },
          { label: "Completed", value: ConsultationStatus.COMPLETED },
          { label: "Cancelled", value: ConsultationStatus.CANCELLED },
        ]}
      />

      <DataTable
        caption="Consultations"
        columns={[
          { key: "when", label: "When" },
          { key: "client", label: "Client" },
          { key: "mode", label: "Type" },
          { key: "status", label: "Status" },
          { key: "amount", label: "Amount", align: "right" },
          { key: "action", label: "", align: "right" },
        ]}
        emptyMessage="No consultations yet."
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
            <p className="caption text-slate-500">{row.user.name || row.user.email}</p>
            <StatusBadge label={row.status} tone={TONE[row.status]} />
            <p className="caption text-slate-500">
              {MODE_LABEL[row.mode]} · {row.durationMinutes} min · {formatPaise(row.grossAmountPaise)}
            </p>
            {row._count.kundliAccess > 0 ? (
              <Link className="caption font-semibold text-blue-700 underline" href="/pandit/kundli">
                Chart shared
              </Link>
            ) : null}
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
            case "client":
              return row.user.name || row.user.email;
            case "mode":
              return `${MODE_LABEL[row.mode]} · ${row.durationMinutes} min`;
            case "status":
              return <StatusBadge label={row.status} tone={TONE[row.status]} />;
            case "amount":
              return row.earning
                ? `${formatPaise(row.grossAmountPaise)} · you ${formatPaise(row.earning.netPayablePaise)}`
                : formatPaise(row.grossAmountPaise);
            default:
              return row.status === ConsultationStatus.REQUESTED ||
                row.status === ConsultationStatus.CONFIRMED ||
                row.status === ConsultationStatus.IN_PROGRESS ? (
                <SimpleActionForm
                  action={completeConsultationAction}
                  confirm="Mark this consultation complete? This settles the earning."
                  hidden={{ consultationId: row.id }}
                  label="Mark complete"
                  pendingLabel="Saving..."
                  variant="secondary"
                />
              ) : null;
          }
        }}
        rows={rows}
      />
    </PanditLayout>
  );
}
