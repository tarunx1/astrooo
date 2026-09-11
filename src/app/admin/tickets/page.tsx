import type { Metadata } from "next";
import { TicketStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { MetricCard, MetricGrid } from "@/components/dashboard/dashboard-shell";
import { TicketQueue } from "@/components/admin/ticket-views";
import { requireAnyPermission } from "@/lib/auth/access";
import { listTickets, ticketCounts } from "@/lib/support/tickets";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 25;

/**
 * The whole support queue.
 *
 * Reaching this page needs `tickets.view` or `tickets.manage`; the scope passed
 * to `listTickets` is "all", which is the difference between this and a
 * reporter's own list. The scope is chosen here from the permission, not taken
 * from the request.
 */
export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const viewer = await requireAnyPermission(["tickets.view", "tickets.manage"]);
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const status =
    params.status && params.status in TicketStatus ? (params.status as TicketStatus) : undefined;

  const [{ rows, total }, counts] = await Promise.all([
    listTickets({ page, pageSize: PAGE_SIZE, scope: { kind: "all" }, search, status }),
    ticketCounts(),
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/tickets"
      description="Everything raised by customers, Pandits and staff."
      title="Support tickets"
    >
      <MetricGrid>
        <MetricCard label="Open" tone={counts.OPEN > 0 ? "warning" : undefined} value={counts.OPEN} />
        <MetricCard label="In progress" value={counts.IN_PROGRESS} />
        <MetricCard label="Waiting for user" value={counts.WAITING_FOR_USER} />
        <MetricCard label="Resolved" value={counts.RESOLVED} />
      </MetricGrid>

      <TicketQueue
        basePath="/admin/tickets"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        status={status}
        total={total}
      />
    </AdminLayout>
  );
}
