"use server";

import { revalidatePath } from "next/cache";
import { TicketStatus } from "@prisma/client";
import { z } from "zod";
import { authorizeAction } from "@/lib/auth/access";
import { assignTicket, replyToTicket, transitionTicket } from "@/lib/support/tickets";
import type { AdminActionState } from "@/lib/admin/action-state";

/**
 * Ticket handling Server Actions.
 *
 * `tickets.manage` is a delegable permission and sits in the default employee
 * bundle - handling support is exactly the operational work the role exists to
 * take on.
 */
const idSchema = z.string().trim().min(1).max(64);

function denied(reason?: string): AdminActionState {
  return { ok: false, error: reason ?? "You are not authorised to perform this action.", fieldErrors: {} };
}

function failure(error: string): AdminActionState {
  return { ok: false, error, fieldErrors: {} };
}

function success(message: string): AdminActionState {
  return { ok: true, error: null, message, fieldErrors: {} };
}

function revalidateTicket(ticketId: string): void {
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/employee/tickets");
  revalidatePath(`/employee/tickets/${ticketId}`);
  revalidatePath("/pandit/tickets");
  revalidatePath("/account/support");
}

export async function replyToTicketAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("tickets.manage");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({ ticketId: idSchema, body: z.string().trim().min(1).max(4_000), internal: z.boolean() })
    .safeParse({
      ticketId: formData.get("ticketId"),
      body: formData.get("body"),
      internal: formData.get("internal") === "on",
    });

  if (!parsed.success) return failure("Write a reply first.");

  const result = await replyToTicket({
    ticketId: parsed.data.ticketId,
    authorUserId: auth.viewer.id,
    body: parsed.data.body,
    internal: parsed.data.internal,
    canManage: true,
  });

  if (!result.ok) return failure(result.message);

  revalidateTicket(parsed.data.ticketId);
  return success(parsed.data.internal ? "Internal note added." : "Reply sent.");
}

export async function transitionTicketAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("tickets.manage");
  if (!auth.ok) return denied(auth.error);

  const parsed = z
    .object({ ticketId: idSchema, to: z.nativeEnum(TicketStatus) })
    .safeParse({ ticketId: formData.get("ticketId"), to: formData.get("to") });

  if (!parsed.success) return failure("That status is not recognised.");

  const result = await transitionTicket({
    ticketId: parsed.data.ticketId,
    to: parsed.data.to,
    actorUserId: auth.viewer.id,
  });

  if (!result.ok) return failure(result.message);

  revalidateTicket(parsed.data.ticketId);
  return success("Ticket updated.");
}

export async function assignTicketAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const auth = await authorizeAction("tickets.manage");
  if (!auth.ok) return denied(auth.error);

  const raw = formData.get("assigneeUserId");
  const parsed = z
    .object({ ticketId: idSchema, assigneeUserId: idSchema.nullable() })
    .safeParse({
      ticketId: formData.get("ticketId"),
      assigneeUserId: typeof raw === "string" && raw.trim() ? raw.trim() : null,
    });

  if (!parsed.success) return failure("That assignment is not recognised.");

  const result = await assignTicket({
    ticketId: parsed.data.ticketId,
    assigneeUserId: parsed.data.assigneeUserId,
    actorUserId: auth.viewer.id,
  });

  if (!result.ok) return failure(result.message);

  revalidateTicket(parsed.data.ticketId);
  return success(parsed.data.assigneeUserId ? "Assigned." : "Unassigned.");
}
