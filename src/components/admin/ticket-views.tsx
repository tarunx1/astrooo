import Link from "next/link";
import { TicketStatus } from "@prisma/client";
import {
  DashboardSection,
  DataTable,
  FilterBar,
  Pagination,
  SearchBar,
  StatusBadge,
} from "@/components/dashboard/dashboard-shell";
import { AdminForm, AdminField, adminInputClass } from "@/components/admin/admin-form";
import { ReplyForm } from "@/components/pandit/pandit-forms";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
  TICKET_TRANSITIONS,
  type TicketDetail,
  type TicketRow,
} from "@/lib/support/tickets";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Ticket queue and detail, shared by the admin and employee areas.
 *
 * One rendering, because a ticket looks the same whoever is working it; what
 * differs is scope, and scope is decided by the route from the viewer's
 * permission and expressed as a `where` clause in the query.
 */
type Action = (state: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function TicketQueue({
  rows,
  total,
  page,
  pageSize,
  basePath,
  status,
  search,
}: {
  rows: TicketRow[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  status?: TicketStatus;
  search?: string;
}) {
  return (
    <>
      <SearchBar action={basePath} defaultValue={search} placeholder="Search by subject or ticket number" />

      <FilterBar
        basePath={basePath}
        current={status}
        options={[
          { label: "All", value: undefined },
          { label: "Open", value: TicketStatus.OPEN },
          { label: "In progress", value: TicketStatus.IN_PROGRESS },
          { label: "Waiting for user", value: TicketStatus.WAITING_FOR_USER },
          { label: "Resolved", value: TicketStatus.RESOLVED },
          { label: "Closed", value: TicketStatus.CLOSED },
        ]}
      />

      <DataTable
        caption="Tickets"
        columns={[
          { key: "subject", label: "Subject" },
          { key: "reporter", label: "Reporter" },
          { key: "category", label: "Category" },
          { key: "status", label: "Status" },
          { key: "assignee", label: "Assigned" },
          { key: "updated", label: "Updated" },
        ]}
        emptyMessage="No tickets match that filter."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <Link className="body-sm font-semibold text-blue-700 underline" href={`${basePath}/${row.id}`}>
              {row.subject}
            </Link>
            <p className="caption font-mono text-slate-400">{row.ticketNumber}</p>
            <p className="caption text-slate-500">
              {row.reporterName || row.reporterEmail} · {row.reporterRole}
            </p>
            <StatusBadge label={TICKET_STATUS_LABEL[row.status]} tone={TICKET_STATUS_TONE[row.status]} />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "subject":
              return (
                <span className="grid">
                  <Link className="font-semibold text-blue-700 underline" href={`${basePath}/${row.id}`}>
                    {row.subject}
                  </Link>
                  <span className="caption font-mono text-slate-400">{row.ticketNumber}</span>
                </span>
              );
            case "reporter":
              return (
                <span className="grid">
                  <span>{row.reporterName || "—"}</span>
                  <span className="caption text-slate-500">{row.reporterRole}</span>
                </span>
              );
            case "category":
              return TICKET_CATEGORY_LABEL[row.category];
            case "status":
              return <StatusBadge label={TICKET_STATUS_LABEL[row.status]} tone={TICKET_STATUS_TONE[row.status]} />;
            case "assignee":
              return row.assigneeName ?? "Unassigned";
            default:
              return row.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          }
        }}
        rows={rows}
      />

      <Pagination
        basePath={basePath}
        page={page}
        pageSize={pageSize}
        query={{ q: search, status }}
        total={total}
      />
    </>
  );
}

export function TicketDetailView({
  ticket,
  staff,
  replyAction,
  transitionAction,
  assignAction,
}: {
  ticket: TicketDetail;
  staff: ReadonlyArray<{ id: string; name: string; email: string }>;
  replyAction: Action;
  transitionAction: Action;
  assignAction: Action;
}) {
  const nextStatuses = TICKET_TRANSITIONS[ticket.status];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-6">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={TICKET_STATUS_LABEL[ticket.status]} tone={TICKET_STATUS_TONE[ticket.status]} />
            <StatusBadge label={TICKET_CATEGORY_LABEL[ticket.category]} tone="neutral" />
            <span className="caption font-mono text-slate-400">{ticket.ticketNumber}</span>
          </div>
          <p className="mt-3 body-sm whitespace-pre-wrap text-slate-800">{ticket.description}</p>
          <p className="mt-3 caption text-slate-500">
            {ticket.reporterName || ticket.reporterEmail} ({ticket.reporterRole}) ·{" "}
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
              No replies yet.
            </p>
          ) : (
            <ol className="grid gap-3">
              {ticket.messages.map((message) => (
                <li
                  className={
                    message.internal
                      ? "rounded-lg border border-amber-200 bg-amber-50 p-4"
                      : "rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
                  }
                  key={message.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="caption font-semibold text-slate-700">{message.authorName}</p>
                    {message.internal ? <StatusBadge label="Internal" tone="warning" /> : null}
                  </div>
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
            <ReplyForm action={replyAction} allowInternal ticketId={ticket.id} />
          </div>
        </DashboardSection>
      </div>

      <div className="grid gap-4 self-start">
        <DashboardSection title="Assign">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <AdminForm action={assignAction} pendingLabel="Saving..." submitLabel="Save assignment" variant="secondary">
              <input name="ticketId" type="hidden" value={ticket.id} />
              <AdminField label="Assigned to" name="assigneeUserId">
                <select
                  className={adminInputClass}
                  defaultValue={ticket.assigneeId ?? ""}
                  id="assigneeUserId"
                  name="assigneeUserId"
                >
                  <option value="">Unassigned</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </AdminField>
            </AdminForm>
          </div>
        </DashboardSection>

        <DashboardSection title="Status">
          {nextStatuses.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 caption text-slate-600">
              This ticket is closed.
            </p>
          ) : (
            <div className="grid gap-2">
              {nextStatuses.map((next) => (
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs" key={next}>
                  <AdminForm
                    action={transitionAction}
                    pendingLabel="Saving..."
                    submitLabel={`Mark ${TICKET_STATUS_LABEL[next].toLowerCase()}`}
                    variant="secondary"
                  >
                    <input name="ticketId" type="hidden" value={ticket.id} />
                    <input name="to" type="hidden" value={next} />
                  </AdminForm>
                </div>
              ))}
            </div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
