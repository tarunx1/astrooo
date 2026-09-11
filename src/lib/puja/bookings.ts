import "server-only";

import { AuditAction, PaymentStatus, Prisma, PujaBookingStatus, PujaMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/admin/audit";
import { getPaymentProvider, getRazorpayPublicKey } from "@/lib/payments/config";
import { isValidMinorUnitAmount, type ProviderPayment } from "@/lib/payments/provider";
import { getBookablePuja } from "@/lib/puja/catalog";
import { canTransitionPuja } from "@/lib/puja/status";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Puja booking.
 *
 * Reuses the same payment abstraction as reports, the shop and consultations -
 * one provider interface, one signature check, one webhook. What is specific
 * here is the Sankalp data and the practitioner assignment, both of which are
 * operator-driven rather than automatic.
 */

/**
 * The Sankalp.
 *
 * These are the family and intention details a ritual is performed under. They
 * are private customer data of the same kind as a birth profile: never in a
 * public query, never in an audit entry, and visible only to the customer and
 * the practitioner actually assigned to perform the ritual.
 */
export const sankalpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gotra: z.string().trim().max(80).nullable(),
  /** Others the ritual is performed on behalf of. */
  familyMembers: z.array(z.string().trim().min(1).max(120)).max(12),
  /** Optional birth details, when the ritual calls for them. */
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  birthPlace: z.string().trim().max(160).nullable(),
  /** What the customer is asking for. Free text, bounded. */
  intention: z.string().trim().max(1_000).nullable(),
});

export type Sankalp = z.infer<typeof sankalpSchema>;

export function parseSankalp(value: Prisma.JsonValue | null): Sankalp | null {
  const parsed = sankalpSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function bookingNumber(now: Date): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(2, 12);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PJ-${stamp}-${suffix}`;
}

export type PujaCheckoutSummary = {
  bookingId: string;
  bookingNumber: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string | null;
  title: string;
};

export type PujaCheckoutResult =
  | { ok: true; summary: PujaCheckoutSummary }
  | { ok: false; message: string };

/**
 * Creates a booking and opens payment for it.
 *
 * Price comes from the catalogue, server-side, and is snapshotted onto the
 * booking together with the title - so a later catalogue edit never rewrites
 * what a customer was charged or what they believed they bought.
 *
 * Unlike a consultation there is no slot to contend for: a ritual is scheduled
 * by an operator afterwards, so the requested date is a preference rather than
 * a reservation.
 */
export async function startPujaCheckout(input: {
  userId: string;
  slug: string;
  mode: PujaMode;
  requestedDate: string | null;
  sankalp: Sankalp;
}): Promise<PujaCheckoutResult> {
  const puja = await getBookablePuja(input.slug);
  if (!puja) return { ok: false, message: "That puja is not currently available." };

  if (!puja.modes.includes(input.mode)) {
    return { ok: false, message: "That option is not offered for this puja." };
  }

  if (!isValidMinorUnitAmount(puja.pricePaise)) {
    return { ok: false, message: "This puja could not be priced. Please contact support." };
  }

  const now = new Date();

  const booking = await prisma.pujaBooking.create({
    data: {
      bookingNumber: bookingNumber(now),
      userId: input.userId,
      pujaId: puja.id,
      status: PujaBookingStatus.PENDING_PAYMENT,
      mode: input.mode,
      requestedDate: input.requestedDate ? new Date(`${input.requestedDate}T00:00:00.000Z`) : null,
      titleSnapshot: puja.title,
      pricePaise: puja.pricePaise,
      currency: puja.currency,
      sankalpJson: input.sankalp as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, bookingNumber: true },
  });

  let providerOrder;
  try {
    providerOrder = await getPaymentProvider().createOrder({
      amountMinor: puja.pricePaise,
      currency: "INR",
      receipt: `puja_${booking.id}`.slice(0, 40),
      notes: { pujaBookingId: booking.id, kind: "puja" },
    });
  } catch (error) {
    // The booking is cancelled rather than left dangling in PENDING_PAYMENT,
    // where it would clutter the operator's queue with something nobody can pay
    // for.
    await prisma.pujaBooking.update({
      where: { id: booking.id },
      data: {
        status: PujaBookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: "Payment could not be started.",
      },
    });

    reportIncident("payment_order_failure", { kind: "puja", slug: input.slug }, error);
    return { ok: false, message: "Payment could not be started. Please try again." };
  }

  await prisma.pujaBooking.update({
    where: { id: booking.id },
    data: { providerOrderId: providerOrder.id },
  });

  logger.info("puja_checkout_started", { bookingId: booking.id, amountMinor: puja.pricePaise });

  return {
    ok: true,
    summary: {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      providerOrderId: providerOrder.id,
      amountMinor: puja.pricePaise,
      currency: puja.currency,
      keyId: getRazorpayPublicKey(),
      title: puja.title,
    },
  };
}

/**
 * Records a verified payment against a Puja booking.
 *
 * Idempotent: a booking that already carries `paidAt` returns success without
 * writing again, so the browser callback and the webhook produce one
 * confirmation between them.
 *
 * A paid booking lands in PANDIT_PENDING rather than CONFIRMED-and-done,
 * because somebody still has to be assigned to perform it. That is the state an
 * operator's queue is built from.
 */
export async function applyVerifiedPujaPayment(
  bookingId: string,
  payment: ProviderPayment,
): Promise<{ ok: true; alreadyPaid: boolean } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.pujaBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        status: true,
        paidAt: true,
        pricePaise: true,
        providerOrderId: true,
      },
    });

    if (!booking) return { ok: false as const, message: "That booking could not be found." };

    if (booking.providerOrderId !== payment.orderId) {
      reportIncident("payment_order_mismatch", { pujaBookingId: bookingId });
      return { ok: false as const, message: "That payment does not belong to this booking." };
    }

    if (payment.amountMinor !== booking.pricePaise) {
      reportIncident("payment_amount_mismatch", {
        pujaBookingId: bookingId,
        expected: booking.pricePaise,
        received: payment.amountMinor,
      });
      return { ok: false as const, message: "The payment amount did not match this booking." };
    }

    await tx.payment.upsert({
      where: { providerPaymentId: payment.id },
      create: {
        provider: payment.provider,
        providerOrderId: payment.orderId,
        providerPaymentId: payment.id,
        providerRef: payment.id,
        pujaBookingId: booking.id,
        userId: booking.userId,
        status: PaymentStatus.CAPTURED,
        amountPaise: payment.amountMinor,
        currency: payment.currency,
        capturedAt: payment.capturedAt ?? new Date(),
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
      update: {
        status: PaymentStatus.CAPTURED,
        capturedAt: payment.capturedAt ?? new Date(),
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
    });

    if (booking.paidAt) return { ok: true as const, alreadyPaid: true };

    if (!canTransitionPuja(booking.status, PujaBookingStatus.PANDIT_PENDING)) {
      reportIncident("consultation_payment_after_close", {
        pujaBookingId: bookingId,
        status: booking.status,
      });
      return {
        ok: false as const,
        message: "This booking is no longer open. Your payment has been recorded for refund.",
      };
    }

    await tx.pujaBooking.update({
      where: { id: booking.id },
      data: { status: PujaBookingStatus.PANDIT_PENDING, paidAt: new Date() },
    });

    logger.info("puja_booking_confirmed", { bookingId, providerPaymentId: payment.id });

    return { ok: true as const, alreadyPaid: false };
  });
}

export async function recordFailedPujaPayment(
  bookingId: string,
  payment: ProviderPayment,
): Promise<void> {
  const booking = await prisma.pujaBooking.findUnique({
    where: { id: bookingId },
    select: { userId: true },
  });

  await prisma.payment.upsert({
    where: { providerPaymentId: payment.id },
    create: {
      provider: payment.provider,
      providerOrderId: payment.orderId,
      providerPaymentId: payment.id,
      providerRef: payment.id,
      pujaBookingId: bookingId,
      userId: booking?.userId ?? null,
      status: PaymentStatus.FAILED,
      amountPaise: payment.amountMinor,
      currency: payment.currency,
      rawResponse: payment as unknown as Prisma.InputJsonValue,
    },
    update: {
      status: PaymentStatus.FAILED,
      rawResponse: payment as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info("puja_payment_failed", { bookingId, providerPaymentId: payment.id });
}

/** Finds the booking a provider order belongs to, for webhook routing. */
export async function findPujaBookingByProviderOrderId(
  providerOrderId: string,
): Promise<{ id: string } | null> {
  return prisma.pujaBooking.findUnique({ where: { providerOrderId }, select: { id: true } });
}

/**
 * Verifies a checkout callback.
 *
 * The same three independent checks as every other purchase kind: the booking
 * is the caller's, the signature is authentic, and the provider's own record
 * says the payment was captured.
 */
export async function verifyPujaPayment(input: {
  bookingId: string;
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const booking = await prisma.pujaBooking.findFirst({
    where: { id: input.bookingId, userId: input.userId },
    select: { id: true, providerOrderId: true },
  });

  if (!booking) return { ok: false, message: "That booking could not be found." };

  if (booking.providerOrderId !== input.orderId) {
    reportIncident("payment_order_mismatch", { pujaBookingId: booking.id });
    return { ok: false, message: "That payment does not belong to this booking." };
  }

  const provider = getPaymentProvider();

  if (
    !provider.verifyPaymentSignature({
      orderId: input.orderId,
      paymentId: input.paymentId,
      signature: input.signature,
    })
  ) {
    reportIncident("payment_signature_failure", { source: "puja_callback" });
    return { ok: false, message: "Payment verification failed. Please contact support." };
  }

  let payment;
  try {
    payment = await provider.fetchPayment(input.paymentId);
  } catch (error) {
    reportIncident("payment_webhook_failure", { stage: "puja_fetch" }, error);
    return {
      ok: false,
      message: "We could not confirm the payment yet. It will be confirmed automatically if it succeeded.",
    };
  }

  if (payment.status !== "captured" && payment.status !== "authorized") {
    return { ok: false, message: "That payment has not completed." };
  }

  const applied = await applyVerifiedPujaPayment(booking.id, payment);
  return applied.ok ? { ok: true } : { ok: false, message: applied.message };
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export type PujaBookingView = {
  id: string;
  bookingNumber: string;
  title: string;
  status: PujaBookingStatus;
  mode: PujaMode;
  requestedDate: Date | null;
  scheduledAt: Date | null;
  pricePaise: number;
  currency: string;
  paidAt: Date | null;
  panditName: string | null;
  pujaSlug: string;
  cancellationReason: string | null;
};

const BOOKING_SELECT = {
  id: true,
  bookingNumber: true,
  titleSnapshot: true,
  status: true,
  mode: true,
  requestedDate: true,
  scheduledAt: true,
  pricePaise: true,
  currency: true,
  paidAt: true,
  cancellationReason: true,
  puja: { select: { slug: true } },
  pandit: { select: { displayName: true } },
} satisfies Prisma.PujaBookingSelect;

function toBookingView(
  row: Prisma.PujaBookingGetPayload<{ select: typeof BOOKING_SELECT }>,
): PujaBookingView {
  return {
    id: row.id,
    bookingNumber: row.bookingNumber,
    title: row.titleSnapshot,
    status: row.status,
    mode: row.mode,
    requestedDate: row.requestedDate,
    scheduledAt: row.scheduledAt,
    pricePaise: row.pricePaise,
    currency: row.currency,
    paidAt: row.paidAt,
    panditName: row.pandit?.displayName ?? null,
    pujaSlug: row.puja.slug,
    cancellationReason: row.cancellationReason,
  };
}

/** One customer's own bookings. Scoped by `userId` in the query. */
export async function listCustomerPujaBookings(userId: string): Promise<PujaBookingView[]> {
  const rows = await prisma.pujaBooking.findMany({
    where: { userId },
    select: BOOKING_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map(toBookingView);
}

/**
 * One booking with its Sankalp, for someone entitled to see it.
 *
 * Two parties qualify: the customer who booked it, and the practitioner
 * actually assigned to perform it. An unassigned practitioner sees nothing,
 * which is why the assignment is part of the `where` rather than checked after.
 */
export async function getPujaBookingWithSankalp(input: {
  bookingId: string;
  viewerUserId: string;
}): Promise<(PujaBookingView & { sankalp: Sankalp | null }) | null> {
  const row = await prisma.pujaBooking.findFirst({
    where: {
      id: input.bookingId,
      OR: [{ userId: input.viewerUserId }, { pandit: { userId: input.viewerUserId } }],
    },
    select: { ...BOOKING_SELECT, sankalpJson: true },
  });

  if (!row) return null;

  return { ...toBookingView(row), sankalp: parseSankalp(row.sankalpJson) };
}

/* ------------------------------------------------------------------ */
/* Operator actions                                                    */
/* ------------------------------------------------------------------ */

/** Assigns or reassigns the practitioner who will perform a ritual. */
export async function assignPujaPandit(input: {
  bookingId: string;
  panditProfileId: string | null;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.pujaBooking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, status: true, bookingNumber: true, panditProfileId: true },
    });

    if (!booking) return { ok: false as const, message: "That booking could not be found." };

    if (input.panditProfileId) {
      // Only an active practitioner can be assigned. Assigning a suspended one
      // would put a ritual on somebody who cannot currently work.
      const pandit = await tx.panditProfile.findFirst({
        where: { id: input.panditProfileId, status: "ACTIVE" },
        select: { id: true },
      });

      if (!pandit) {
        return { ok: false as const, message: "That practitioner is not available for assignment." };
      }
    }

    const nextStatus = input.panditProfileId
      ? PujaBookingStatus.ASSIGNED
      : PujaBookingStatus.PANDIT_PENDING;

    if (booking.status !== nextStatus && !canTransitionPuja(booking.status, nextStatus)) {
      return {
        ok: false as const,
        message: `A booking in ${booking.status} cannot be reassigned.`,
      };
    }

    await tx.pujaBooking.update({
      where: { id: booking.id },
      data: {
        panditProfileId: input.panditProfileId,
        assignedById: input.panditProfileId ? input.actorUserId : null,
        assignedAt: input.panditProfileId ? new Date() : null,
        status: nextStatus,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.PUJA_PANDIT_ASSIGNED,
      entityType: "PujaBooking",
      entityId: booking.id,
      // Ids and the reference only. The Sankalp never enters the audit log.
      metadata: {
        bookingNumber: booking.bookingNumber,
        from: booking.panditProfileId,
        to: input.panditProfileId,
      },
    });

    return { ok: true as const };
  });
}

/** Moves a booking through its lifecycle. */
export async function transitionPujaBooking(input: {
  bookingId: string;
  to: PujaBookingStatus;
  actorUserId: string;
  scheduledAt?: Date | null;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.pujaBooking.findUnique({
      where: { id: input.bookingId },
      select: { id: true, status: true, bookingNumber: true, panditProfileId: true },
    });

    if (!booking) return { ok: false as const, message: "That booking could not be found." };

    if (!canTransitionPuja(booking.status, input.to)) {
      return {
        ok: false as const,
        message: `A booking cannot move from ${booking.status} to ${input.to}.`,
      };
    }

    if (input.to === PujaBookingStatus.SCHEDULED) {
      if (!input.scheduledAt) {
        return { ok: false as const, message: "Give the date and time the ritual will be performed." };
      }
      if (!booking.panditProfileId) {
        return { ok: false as const, message: "Assign a practitioner before scheduling." };
      }
    }

    const now = new Date();

    await tx.pujaBooking.update({
      where: { id: booking.id },
      data: {
        status: input.to,
        ...(input.scheduledAt ? { scheduledAt: input.scheduledAt } : {}),
        ...(input.to === PujaBookingStatus.COMPLETED ? { completedAt: now } : {}),
        ...(input.to === PujaBookingStatus.CANCELLED
          ? { cancelledAt: now, cancellationReason: input.note?.trim().slice(0, 500) ?? null }
          : {}),
        ...(input.note && input.to !== PujaBookingStatus.CANCELLED
          ? { operatorNote: input.note.trim().slice(0, 1_000) }
          : {}),
      },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      action: AuditAction.PUJA_BOOKING_STATUS_CHANGED,
      entityType: "PujaBooking",
      entityId: booking.id,
      metadata: { bookingNumber: booking.bookingNumber, from: booking.status, to: input.to },
    });

    return { ok: true as const };
  });
}

/** The operator queue. Never selects the Sankalp. */
export async function listPujaBookingsForOperators(input: {
  page: number;
  pageSize: number;
  status?: PujaBookingStatus;
}): Promise<{ rows: Array<PujaBookingView & { customerName: string }>; total: number }> {
  const where: Prisma.PujaBookingWhereInput = input.status ? { status: input.status } : {};

  const [rows, total] = await Promise.all([
    prisma.pujaBooking.findMany({
      where,
      select: { ...BOOKING_SELECT, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.pujaBooking.count({ where }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      ...toBookingView(row),
      customerName: row.user.name || row.user.email,
    })),
  };
}
