import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { TicketDetailView } from "@/components/admin/ticket-views";
import { requireAnyPermission, viewerCan } from "@/lib/auth/access";
import { getTicket } from "@/lib/support/tickets";
import { listAssignableStaff } from "@/lib/support/staff";
import { assignTicketAction, replyToTicketAction, transitionTicketAction } from "@/app/admin/tickets/actions";

export const metadata: Metadata = { title: "Ticket" };

export default async function EmployeeTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAnyPermission(["tickets.view", "tickets.manage"]);
  const { id } = await params;

  const canManage = viewerCan(viewer, "tickets.manage");

  const [ticket, staff] = await Promise.all([
    getTicket({
      ticketId: id,
      viewerUserId: viewer.id,
      // Without `tickets.manage`, the query is scoped to tickets this person
      // reported or is assigned - so the whole queue is not readable by
      // guessing an id.
      canSeeAll: canManage,
      canSeeInternal: canManage,
    }),
    listAssignableStaff(),
  ]);

  if (!ticket) notFound();

  return (
    <EmployeeLayout
      currentPath="/employee/tickets"
      description={`${ticket.ticketNumber} · raised by ${ticket.reporterName || ticket.reporterEmail}`}
      eyebrow="Support"
      title={ticket.subject}
    >
      <TicketDetailView
        assignAction={assignTicketAction}
        replyAction={replyToTicketAction}
        staff={staff}
        ticket={ticket}
        transitionAction={transitionTicketAction}
      />
    </EmployeeLayout>
  );
}
