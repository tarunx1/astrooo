import type { Metadata } from "next";
import { TicketStatus } from "@prisma/client";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { TicketQueue } from "@/components/admin/ticket-views";
import { requireAnyPermission, viewerCan } from "@/lib/auth/access";
import { listTickets } from "@/lib/support/tickets";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 25;

/**
 * The employee's ticket queue.
 *
 * Someone with `tickets.manage` works the whole queue; someone with only
 * `tickets.view` sees what is assigned to them plus what is unassigned, so they
 * can pick work up without being able to read every conversation on the
 * platform. The scope is derived here from the permission, never from a
 * parameter the browser could widen.
 */
export default async function EmployeeTicketsPage({
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

  const { rows, total } = await listTickets({
    page,
    pageSize: PAGE_SIZE,
    scope: viewerCan(viewer, "tickets.manage")
      ? { kind: "all" }
      : { kind: "assignee", userId: viewer.id },
    search,
    status,
  });

  return (
    <EmployeeLayout
      currentPath="/employee/tickets"
      description="Support requests you can work on."
      eyebrow="Support"
      title="Tickets"
    >
      <TicketQueue
        basePath="/employee/tickets"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        status={status}
        total={total}
      />
    </EmployeeLayout>
  );
}
