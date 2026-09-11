import type { Metadata } from "next";
import Link from "next/link";
import { TicketCategory } from "@prisma/client";
import { DashboardSection, DataTable, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { TicketForm } from "@/components/pandit/pandit-forms";
import { requirePandit } from "@/lib/pandit/guard";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, listTickets } from "@/lib/support/tickets";
import { createPanditTicketAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Support tickets" };

/**
 * A Pandit's own tickets.
 *
 * Available at every onboarding stage, including before approval - support is
 * most needed when something about the application is stuck.
 *
 * Scoped to the reporter in the query, so this page cannot show somebody
 * else's ticket even by accident.
 */
export default async function PanditTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const identity = await requirePandit("/pandit/tickets");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { rows } = await listTickets({
    page,
    pageSize: 25,
    scope: { kind: "reporter", userId: identity.userId },
  });

  return (
    <PanditLayout
      currentPath="/pandit/tickets"
      description="Raise anything that is stuck and follow it here."
      eyebrow="Support"
      identity={identity}
      title="Support tickets"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DashboardSection title="Your tickets">
          <DataTable
            caption="Tickets"
            columns={[
              { key: "subject", label: "Subject" },
              { key: "category", label: "Category" },
              { key: "status", label: "Status" },
              { key: "updated", label: "Updated" },
            ]}
            emptyMessage="You have not raised any tickets."
            getKey={(row) => row.id}
            renderCard={(row) => (
              <div className="grid gap-1.5">
                <Link className="body-sm font-semibold text-blue-700 underline" href={`/pandit/tickets/${row.id}`}>
                  {row.subject}
                </Link>
                <p className="caption text-slate-500">{row.ticketNumber}</p>
                <StatusBadge label={TICKET_STATUS_LABEL[row.status]} tone={TICKET_STATUS_TONE[row.status]} />
              </div>
            )}
            renderCell={(row, key) => {
              switch (key) {
                case "subject":
                  return (
                    <span className="grid">
                      <Link className="font-semibold text-blue-700 underline" href={`/pandit/tickets/${row.id}`}>
                        {row.subject}
                      </Link>
                      <span className="caption font-mono text-slate-400">{row.ticketNumber}</span>
                    </span>
                  );
                case "category":
                  return TICKET_CATEGORY_LABEL[row.category];
                case "status":
                  return <StatusBadge label={TICKET_STATUS_LABEL[row.status]} tone={TICKET_STATUS_TONE[row.status]} />;
                default:
                  return row.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
              }
            }}
            rows={rows}
          />
        </DashboardSection>

        <DashboardSection title="Raise a ticket">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <TicketForm action={createPanditTicketAction} categories={Object.values(TicketCategory)} />
          </div>
        </DashboardSection>
      </div>
    </PanditLayout>
  );
}
