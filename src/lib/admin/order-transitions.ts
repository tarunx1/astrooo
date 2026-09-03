import "server-only";

import { AuditAction, OrderStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";

/**
 * Fulfilment state machine.
 *
 * Two rules define what an operator may do:
 *
 * 1. **Fulfilment only.** An operator moves an order forward through
 *    preparation, dispatch and delivery. They can never create a payment fact —
 *    PENDING_PAYMENT to PAID is absent from this table on purpose, because that
 *    transition belongs to verified payment processing alone.
 * 2. **Forward or cancel.** There is no path back from DELIVERED, and no way to
 *    reach PENDING_PAYMENT from anywhere. Cancellation is allowed only before
 *    dispatch.
 */
export const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
};

export function allowedNextStatuses(current: OrderStatus): readonly OrderStatus[] {
  return ALLOWED_TRANSITIONS[current] ?? [];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return allowedNextStatuses(from).includes(to);
}

export type TransitionOutcome =
  | { ok: true; from: OrderStatus; to: OrderStatus }
  | { ok: false; reason: "not_found" | "invalid_transition" | "conflict"; message: string };

/** Timestamps stamped once, on first entry to each state. */
function timestampsFor(to: OrderStatus, now: Date): Prisma.OrderUpdateInput {
  switch (to) {
    case OrderStatus.PROCESSING:
      return { processingAt: now };
    case OrderStatus.SHIPPED:
      return { shippedAt: now };
    case OrderStatus.DELIVERED:
      return { deliveredAt: now };
    case OrderStatus.CANCELLED:
      return { cancelledAt: now };
    default:
      return {};
  }
}

/**
 * Moves an order to a new fulfilment state.
 *
 * The current status is re-read inside the transaction and the update is
 * guarded on it, so a browser-supplied "current status" is never trusted and two
 * operators acting at once cannot both succeed.
 */
export async function transitionOrderStatus(input: {
  adminUserId: string;
  orderId: string;
  to: OrderStatus;
}): Promise<TransitionOutcome> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!order) {
      return { ok: false as const, reason: "not_found" as const, message: "That order could not be found." };
    }

    if (!canTransition(order.status, input.to)) {
      return {
        ok: false as const,
        reason: "invalid_transition" as const,
        message: `An order cannot move from ${order.status} to ${input.to}.`,
      };
    }

    const now = new Date();

    // Guarded on the status we just read: a concurrent transition loses.
    const applied = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: input.to, ...(timestampsFor(input.to, now) as Prisma.OrderUpdateManyMutationInput) },
    });

    if (applied.count !== 1) {
      return {
        ok: false as const,
        reason: "conflict" as const,
        message: "This order changed while you were working. Reload and try again.",
      };
    }

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action: AuditAction.ORDER_STATUS_CHANGED,
      entityType: "Order",
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber, from: order.status, to: input.to },
    });

    return { ok: true as const, from: order.status, to: input.to };
  });
}

export type ShipmentOutcome = { ok: true } | { ok: false; message: string };

/**
 * Records manual shipment metadata.
 *
 * No carrier integration exists, so nothing here is verified against a carrier.
 * These are operator-entered values and the customer-facing page says so.
 */
export async function updateShipmentDetails(input: {
  adminUserId: string;
  orderId: string;
  carrierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}): Promise<ShipmentOutcome> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, orderNumber: true },
    });

    if (!order) return { ok: false as const, message: "That order could not be found." };

    await tx.order.update({
      where: { id: order.id },
      data: {
        carrierName: input.carrierName?.trim() || null,
        trackingNumber: input.trackingNumber?.trim() || null,
        trackingUrl: input.trackingUrl?.trim() || null,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      action: AuditAction.ORDER_SHIPMENT_UPDATED,
      entityType: "Order",
      entityId: order.id,
      metadata: {
        orderNumber: order.orderNumber,
        carrierName: input.carrierName?.trim() || null,
        hasTrackingNumber: Boolean(input.trackingNumber?.trim()),
      },
    });

    return { ok: true as const };
  });
}
