import "server-only";

import { ConsultationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/config";
import { applyVerifiedConsultationPayment } from "@/lib/consultations/checkout";
import { cancellationDecision, CLOSED_STATUSES, UPCOMING_STATUSES } from "@/lib/consultations/status";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Booking reads and customer-side writes.
 *
 * Every query is scoped by ownership inside the `where` clause rather than
 * compared after fetching, so another customer's booking resolves to "not
 * found" instead of to a row that then has to be denied. The same shape is used
 * on the Pandit side, scoped through `pandit: { userId }`.
 */

export type BookingView = {
  id: string;
  status: ConsultationStatus;
  mode: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  durationMinutes: number;
  timezone: string;
  grossAmountPaise: number;
  currency: string;
  paidAt: Date | null;
  notes: string | null;
  cancellationReason: string | null;
  counterpartName: string;
  counterpartSlug: string | null;
  unreadMessages: number;
};

const BOOKING_SELECT = {
  id: true,
  status: true,
  mode: true,
  scheduledStart: true,
  scheduledEnd: true,
  durationMinutes: true,
  timezone: true,
  grossAmountPaise: true,
  currency: true,
  paidAt: true,
  notes: true,
  cancellationReason: true,
  userId: true,
  user: { select: { name: true, email: true } },
  pandit: { select: { displayName: true, slug: true, userId: true } },
} satisfies Prisma.ConsultationSelect;

type BookingRow = Prisma.ConsultationGetPayload<{ select: typeof BOOKING_SELECT }>;

function toView(row: BookingRow, side: "customer" | "pandit", unread: number): BookingView {
  return {
    id: row.id,
    status: row.status,
    mode: row.mode,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    durationMinutes: row.durationMinutes,
    timezone: row.timezone,
    grossAmountPaise: row.grossAmountPaise,
    currency: row.currency,
    paidAt: row.paidAt,
    notes: row.notes,
    cancellationReason: row.cancellationReason,
    counterpartName:
      side === "customer" ? row.pandit.displayName : row.user.name || row.user.email,
    counterpartSlug: side === "customer" ? row.pandit.slug : null,
    unreadMessages: unread,
  };
}

export type BookingScope = "upcoming" | "completed" | "cancelled" | "all";

function scopeWhere(scope: BookingScope): Prisma.ConsultationWhereInput {
  switch (scope) {
    case "upcoming":
      return { status: { in: [...UPCOMING_STATUSES] } };
    case "completed":
      return { status: ConsultationStatus.COMPLETED };
    case "cancelled":
      return {
        status: { in: [ConsultationStatus.CANCELLED, ConsultationStatus.NO_SHOW, ConsultationStatus.REFUNDED] },
      };
    default:
      return {};
  }
}

/** One customer's own bookings. Scoped by `userId` in the query. */
export async function listCustomerBookings(input: {
  userId: string;
  scope: BookingScope;
}): Promise<BookingView[]> {
  const rows = await prisma.consultation.findMany({
    where: { userId: input.userId, ...scopeWhere(input.scope) },
    select: BOOKING_SELECT,
    orderBy: input.scope === "upcoming" ? { scheduledStart: "asc" } : { scheduledStart: "desc" },
    take: 100,
  });

  const unread = await unreadCounts(rows.map((row) => row.id), input.userId);
  return rows.map((row) => toView(row, "customer", unread.get(row.id) ?? 0));
}

/** One Pandit's own bookings. Scoped through the profile's owning user. */
export async function listPanditBookings(input: {
  panditUserId: string;
  scope: BookingScope | "today";
}): Promise<BookingView[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60_000);

  const where: Prisma.ConsultationWhereInput =
    input.scope === "today"
      ? {
          pandit: { userId: input.panditUserId },
          scheduledStart: { gte: startOfDay, lt: endOfDay },
        }
      : { pandit: { userId: input.panditUserId }, ...scopeWhere(input.scope) };

  const rows = await prisma.consultation.findMany({
    where,
    select: BOOKING_SELECT,
    orderBy: input.scope === "completed" || input.scope === "cancelled" ? { scheduledStart: "desc" } : { scheduledStart: "asc" },
    take: 100,
  });

  const unread = await unreadCounts(rows.map((row) => row.id), input.panditUserId);
  return rows.map((row) => toView(row, "pandit", unread.get(row.id) ?? 0));
}

/** Unread message counts, for the badge on a booking row. */
async function unreadCounts(
  consultationIds: readonly string[],
  viewerUserId: string,
): Promise<Map<string, number>> {
  if (consultationIds.length === 0) return new Map();

  const rows = await prisma.chatMessage.groupBy({
    by: ["consultationId"],
    where: {
      consultationId: { in: [...consultationIds] },
      readAt: null,
      NOT: { senderId: viewerUserId },
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.consultationId, row._count._all]));
}

/**
 * One booking, for a participant.
 *
 * The `OR` is the authorization: you are the customer or you are the Pandit.
 * Anyone else gets null, which the page renders as a 404.
 */
export async function getBookingForParticipant(input: {
  consultationId: string;
  viewerUserId: string;
}): Promise<BookingView | null> {
  const row = await prisma.consultation.findFirst({
    where: {
      id: input.consultationId,
      OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
    },
    select: BOOKING_SELECT,
  });

  if (!row) return null;

  const side = row.userId === input.viewerUserId ? "customer" : "pandit";
  const unread = await unreadCounts([row.id], input.viewerUserId);

  return toView(row, side, unread.get(row.id) ?? 0);
}

/**
 * Verifies a checkout callback and confirms the booking.
 *
 * Three independent checks before anything is written: the booking belongs to
 * the caller, the signature is authentic, and the provider's own record of the
 * payment says it was captured. The browser's assertion of success is not one
 * of them.
 */
export async function verifyConsultationPayment(input: {
  consultationId: string;
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const consultation = await prisma.consultation.findFirst({
    where: { id: input.consultationId, userId: input.userId },
    select: { id: true, providerOrderId: true },
  });

  if (!consultation) return { ok: false, message: "That booking could not be found." };

  if (consultation.providerOrderId !== input.orderId) {
    reportIncident("payment_order_mismatch", { consultationId: consultation.id });
    return { ok: false, message: "That payment does not belong to this booking." };
  }

  const provider = getPaymentProvider();

  const authentic = provider.verifyPaymentSignature({
    orderId: input.orderId,
    paymentId: input.paymentId,
    signature: input.signature,
  });

  if (!authentic) {
    reportIncident("payment_signature_failure", { source: "consultation_callback" });
    return { ok: false, message: "Payment verification failed. Please contact support." };
  }

  // Re-fetched from the provider rather than trusted from the callback: a valid
  // signature proves the response came from Razorpay, not that the payment was
  // actually captured.
  let payment;
  try {
    payment = await provider.fetchPayment(input.paymentId);
  } catch (error) {
    reportIncident("payment_webhook_failure", { stage: "consultation_fetch" }, error);
    return {
      ok: false,
      message: "We could not confirm the payment yet. It will be confirmed automatically if it succeeded.",
    };
  }

  if (payment.status !== "captured" && payment.status !== "authorized") {
    return { ok: false, message: "That payment has not completed." };
  }

  const applied = await applyVerifiedConsultationPayment(consultation.id, payment);
  if (!applied.ok) return { ok: false, message: applied.message };

  return { ok: true };
}

/**
 * Cancels a booking on the customer's own authority.
 *
 * The policy decision comes from `cancellationDecision`, which is the same
 * function the UI uses to decide whether to offer the button - so a customer is
 * never shown a cancel action that the server then refuses.
 */
export async function cancelConsultationForUser(input: {
  consultationId: string;
  userId: string;
  reason: string | null;
}): Promise<{ ok: true; refundable: boolean } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({
      where: {
        id: input.consultationId,
        OR: [{ userId: input.userId }, { pandit: { userId: input.userId } }],
      },
      select: { id: true, status: true, scheduledStart: true, slotId: true, paidAt: true },
    });

    if (!consultation) return { ok: false as const, message: "That booking could not be found." };

    const decision = cancellationDecision({
      status: consultation.status,
      scheduledStart: consultation.scheduledStart,
    });

    if (!decision.allowed) return { ok: false as const, message: decision.reason };

    await tx.consultation.update({
      where: { id: consultation.id },
      data: {
        status: ConsultationStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: input.userId,
        cancellationReason: input.reason?.trim().slice(0, 500) || null,
        slotId: null,
      },
    });

    // Deleting the slot row is what returns the time to the calendar. The
    // consultation keeps its own scheduled times as the record of what was
    // booked.
    if (consultation.slotId) {
      await tx.consultationSlot.delete({ where: { id: consultation.slotId } });
    }

    logger.info("consultation_cancelled", {
      consultationId: consultation.id,
      refundable: decision.refundable,
      wasPaid: consultation.paidAt !== null,
    });

    // `refundable` is a policy statement, not a transfer. No refund is issued
    // automatically anywhere in this application; it tells an operator which
    // cancellations they owe one on.
    return { ok: true as const, refundable: decision.refundable && consultation.paidAt !== null };
  });
}

/** Counts for the customer dashboard tabs. */
export async function customerBookingCounts(userId: string): Promise<{
  upcoming: number;
  completed: number;
  cancelled: number;
}> {
  const [upcoming, completed, cancelled] = await Promise.all([
    prisma.consultation.count({ where: { userId, status: { in: [...UPCOMING_STATUSES] } } }),
    prisma.consultation.count({ where: { userId, status: ConsultationStatus.COMPLETED } }),
    prisma.consultation.count({
      where: {
        userId,
        status: { in: CLOSED_STATUSES.filter((status) => status !== ConsultationStatus.COMPLETED) },
      },
    }),
  ]);

  return { upcoming, completed, cancelled };
}
