import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { ReplyForm } from "@/components/pandit/pandit-forms";
import { requirePandit } from "@/lib/pandit/guard";
import { TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, getTicket } from "@/lib/support/tickets";
import { replyToOwnTicketAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Ticket" };

/**
 * One of the Pandit's own tickets.
 *
 * `canSeeAll` and `canSeeInternal` are both false, so the query is scoped to
 * tickets they reported and internal operator notes are never selected - not
 * fetched and hidden, but absent from the response.
 */
export default async function PanditTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const identity = await requirePandit("/pandit/tickets");
  const { id } = await params;

  const ticket = await getTicket({
    ticketId: id,
    viewerUserId: identity.userId,
    canSeeAll: false,
    canSeeInternal: false,
  });

  if (!ticket) notFound();

  return (
    <PanditLayout
      currentPath="/pandit/tickets"
      description={`${ticket.ticketNumber} · ${TICKET_CATEGORY_LABEL[ticket.category]}`}
      eyebrow="Support"
      identity={identity}
      title={ticket.subject}
    >
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <StatusBadge label={TICKET_STATUS_LABEL[ticket.status]} tone={TICKET_STATUS_TONE[ticket.status]} />
        <p className="mt-3 body-sm whitespace-pre-wrap text-slate-800">{ticket.description}</p>
        <p className="mt-3 caption text-slate-500">
          Raised{" "}
          {ticket.createdAt.toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <DashboardSection title="Conversation">
        {ticket.messages.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-5 body-sm text-slate-500 shadow-xs">
            No replies yet. Support will respond here.
          </p>
        ) : (
          <ol className="grid gap-3">
            {ticket.messages.map((message) => (
              <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs" key={message.id}>
                <p className="caption font-semibold text-slate-700">{message.authorName}</p>
                <p className="mt-1.5 body-sm whitespace-pre-wrap text-slate-800">{message.body}</p>
                <p className="mt-2 caption text-slate-400">
                  {message.createdAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DashboardSection>

      <DashboardSection title="Reply">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <ReplyForm action={replyToOwnTicketAction} ticketId={ticket.id} />
        </div>
      </DashboardSection>
    </PanditLayout>
  );
}
