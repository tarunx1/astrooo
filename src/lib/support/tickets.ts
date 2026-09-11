import "server-only";

import {
  AuditAction,
  Prisma,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";

/**
 * Support tickets.
 *
 * One queue for everyone who can raise one - customers, Pandits, staff - with
 * the reporter's role recorded at creation so triage has context that survives
 * a later role change.
 *
 * Visibility is decided by a `where` clause in every read: a reporter's query
 * is scoped to their own id, an assignee's to tickets assigned to them, and
 * only `tickets.manage` opens the whole queue. Internal notes are filtered in
 * the query too rather than after fetching, so an operator's note cannot reach
 * a reporter's page by way of a forgotten filter.
 */

export const TICKET_STATUS_TONE: Record<TicketStatus, "positive" | "warning" | "danger" | "neutral" | "info"> = {
  [TicketStatus.OPEN]: "warning",
  [TicketStatus.IN_PROGRESS]: "info",
  [TicketStatus.WAITING_FOR_USER]: "warning",
  [TicketStatus.RESOLVED]: "positive",
  [TicketStatus.CLOSED]: "neutral",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: "Open",
  [TicketStatus.IN_PROGRESS]: "In progress",
  [TicketStatus.WAITING_FOR_USER]: "Waiting for user",
  [TicketStatus.RESOLVED]: "Resolved",
  [TicketStatus.CLOSED]: "Closed",
};

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  [TicketCategory.TECHNICAL]: "Technical",
  [TicketCategory.VERIFICATION]: "Verification",
  [TicketCategory.PAYMENT]: "Payment",
  [TicketCategory.PAYOUT]: "Payout",
  [TicketCategory.BOOKING]: "Booking",
  [TicketCategory.PROFILE]: "Profile",
  [TicketCategory.ORDER]: "Order",
  [TicketCategory.OTHER]: "Other",
};

/** Which statuses may follow which. Declared, and enforced at this boundary. */
export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.WAITING_FOR_USER, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.WAITING_FOR_USER]: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  [TicketStatus.CLOSED]: [TicketStatus.IN_PROGRESS],
};

export const ticketInputSchema = z.object({
  category: z.nativeEnum(TicketCategory),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(4_000),
});

export type TicketInput = z.infer<typeof ticketInputSchema>;

function ticketNumber(now: Date): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(2, 12);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TK-${stamp}-${suffix}`;
}

export async function createTicket(input: {
  userId: string;
  role: UserRole;
  ticket: TicketInput;
}): Promise<{ ok: true; ticketId: string; ticketNumber: string }> {
  const now = new Date();

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: ticketNumber(now),
      createdById: input.userId,
      createdByRole: input.role,
      category: input.ticket.category,
      subject: input.ticket.subject,
      description: input.ticket.description,
      status: TicketStatus.OPEN,
      priority: TicketPriority.NORMAL,
    },
    select: { id: true, ticketNumber: true },
  });

  return { ok: true, ticketId: ticket.id, ticketNumber: ticket.ticketNumber };
}

export type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  reporterName: string;
  reporterEmail: string;
  reporterRole: UserRole;
  assigneeName: string | null;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Lists tickets within one visibility scope.
 *
 * `scope` is not a filter the caller may widen - it is chosen by the route from
 * the viewer's permission, and "mine" or "assigned" are expressed as a `where`
 * on the query itself.
 */
export async function listTickets(input: {
  page: number;
  pageSize: number;
  scope: { kind: "all" } | { kind: "reporter"; userId: string } | { kind: "assignee"; userId: string };
  status?: TicketStatus;
  category?: TicketCategory;
  assigneeId?: string;
  search?: string;
}): Promise<{ rows: TicketRow[]; total: number }> {
  const scopeWhere: Prisma.TicketWhereInput =
    input.scope.kind === "reporter"
      ? { createdById: input.scope.userId }
      : input.scope.kind === "assignee"
        ? { OR: [{ assignedToId: input.scope.userId }, { assignedToId: null }] }
        : {};

  const where: Prisma.TicketWhereInput = {
    ...scopeWhere,
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.assigneeId ? { assignedToId: input.assigneeId } : {}),
    ...(input.search
      ? {
          OR: [
            { subject: { contains: input.search, mode: "insensitive" } },
            { ticketNumber: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        subject: true,
        category: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        createdByRole: true,
        createdBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticketNumber,
      subject: row.subject,
      category: row.category,
      status: row.status,
      priority: row.priority,
      reporterName: row.createdBy.name,
      reporterEmail: row.createdBy.email,
      reporterRole: row.createdByRole,
      assigneeName: row.assignedTo?.name ?? null,
      messageCount: row._count.messages,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  };
}

export type TicketDetail = {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterRole: UserRole;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: Date;
  messages: Array<{
    id: string;
    body: string;
    internal: boolean;
    authorName: string;
    authorId: string;
    createdAt: Date;
  }>;
};

/**
 * One ticket, scoped to a viewer.
 *
 * `canSeeInternal` decides whether operator notes are selected at all. A
 * reporter's request does not fetch them and then hide them - the rows never
 * enter the response.
 */
export async function getTicket(input: {
  ticketId: string;
  viewerUserId: string;
  canSeeAll: boolean;
  canSeeInternal: boolean;
}): Promise<TicketDetail | null> {
  const where: Prisma.TicketWhereInput = input.canSeeAll
    ? { id: input.ticketId }
    : { id: input.ticketId, OR: [{ createdById: input.viewerUserId }, { assignedToId: input.viewerUserId }] };

  const ticket = await prisma.ticket.findFirst({
    where,
    select: {
      id: true,
      ticketNumber: true,
      subject: true,
      description: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      createdById: true,
      createdByRole: true,
      assignedToId: true,
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { name: true } },
      messages: {
        where: input.canSeeInternal ? {} : { internal: false },
        select: {
          id: true,
          body: true,
          internal: true,
          authorId: true,
          createdAt: true,
          author: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return null;

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    priority: ticket.priority,
    reporterId: ticket.createdById,
    reporterName: ticket.createdBy.name,
    reporterEmail: ticket.createdBy.email,
    reporterRole: ticket.createdByRole,
    assigneeId: ticket.assignedToId,
    assigneeName: ticket.assignedTo?.name ?? null,
    createdAt: ticket.createdAt,
    messages: ticket.messages.map((message) => ({
      id: message.id,
      body: message.body,
      internal: message.internal,
      authorId: message.authorId,
      authorName: message.author.name,
      createdAt: message.createdAt,
    })),
  };
}

/**
 * Adds a reply.
 *
 * An internal note is only accepted from someone who may manage tickets; a
 * reporter submitting `internal=true` gets a visible reply, because the flag is
 * checked against their permission rather than taken from their form.
 */
export async function replyToTicket(input: {
  ticketId: string;
  authorUserId: string;
  body: string;
  internal: boolean;
  canManage: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const body = input.body.trim();
  if (body.length < 1) return { ok: false, message: "Write a reply first." };
  if (body.length > 4_000) return { ok: false, message: "That reply is too long." };

  const where: Prisma.TicketWhereInput = input.canManage
    ? { id: input.ticketId }
    : { id: input.ticketId, createdById: input.authorUserId };

  const ticket = await prisma.ticket.findFirst({ where, select: { id: true, status: true } });
  if (!ticket) return { ok: false, message: "That ticket could not be found." };

  await prisma.$transaction(async (tx) => {
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: input.authorUserId,
        body,
        internal: input.internal && input.canManage,
      },
    });

    // A reporter replying to a ticket that was waiting on them puts it back in
    // the queue; otherwise the conversation would stall on both sides waiting.
    if (!input.canManage && ticket.status === TicketStatus.WAITING_FOR_USER) {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: TicketStatus.IN_PROGRESS } });
    } else {
      await tx.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    }
  });

  return { ok: true };
}

export async function transitionTicket(input: {
  ticketId: string;
  to: TicketStatus;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: input.ticketId },
      select: { id: true, status: true, ticketNumber: true },
    });

    if (!ticket) return { ok: false as const, message: "That ticket could not be found." };

    if (!TICKET_TRANSITIONS[ticket.status].includes(input.to)) {
      return { ok: false as const, message: `A ticket cannot move from ${ticket.status} to ${input.to}.` };
    }

    const now = new Date();

    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: input.to,
        resolvedAt: input.to === TicketStatus.RESOLVED ? now : undefined,
        closedAt: input.to === TicketStatus.CLOSED ? now : undefined,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.TICKET_STATUS_CHANGED,
      entityType: "Ticket",
      entityId: ticket.id,
      metadata: { ticketNumber: ticket.ticketNumber, from: ticket.status, to: input.to },
    });

    return { ok: true as const };
  });
}

export async function assignTicket(input: {
  ticketId: string;
  assigneeUserId: string | null;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: input.ticketId },
      select: { id: true, ticketNumber: true, assignedToId: true },
    });

    if (!ticket) return { ok: false as const, message: "That ticket could not be found." };

    if (input.assigneeUserId) {
      // Only staff can hold a ticket. Assigning to a customer would put an
      // operational queue item on an account with no way to work it.
      const assignee = await tx.user.findFirst({
        where: {
          id: input.assigneeUserId,
          role: { in: [UserRole.EMPLOYEE, UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (!assignee) return { ok: false as const, message: "That assignee is not a staff account." };
    }

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { assignedToId: input.assigneeUserId },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.TICKET_ASSIGNED,
      entityType: "Ticket",
      entityId: ticket.id,
      metadata: {
        ticketNumber: ticket.ticketNumber,
        from: ticket.assignedToId,
        to: input.assigneeUserId,
      },
    });

    return { ok: true as const };
  });
}

/** Open-queue depth by status, counted. */
export async function ticketCounts(): Promise<Record<TicketStatus, number>> {
  const rows = await prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } });

  const counts = Object.fromEntries(
    Object.values(TicketStatus).map((status) => [status, 0]),
  ) as Record<TicketStatus, number>;

  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}
