import "server-only";

import { ConsultationMode, ConsultationStatus, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider, getRazorpayPublicKey } from "@/lib/payments/config";
import { isValidMinorUnitAmount, type ProviderPayment } from "@/lib/payments/provider";
import { bookConsultation, cancelConsultation } from "@/lib/pandit/schedule";
import { getBookablePandit } from "@/lib/consultations/directory";
import { canTransitionConsultation } from "@/lib/consultations/status";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Consultation checkout.
 *
 * Built on the payment abstraction the reports and the shop already use, not a
 * second Razorpay implementation: one provider interface, one signature
 * verification, one webhook endpoint. What is specific to consultations is the
 * slot hold and the commission snapshot, and those live here.
 *
 * The order of operations matters. The slot is reserved *before* the provider
 * order is created, so a customer is never sent to a payment page for a time
 * somebody else is already paying for. If order creation then fails, the hold
 * is released immediately rather than being left for the sweeper.
 */

export type CheckoutSummary = {
  consultationId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string | null;
  panditName: string;
  scheduledStart: Date;
  durationMinutes: number;
  mode: ConsultationMode;
};

export type CheckoutResult = { ok: true; summary: CheckoutSummary } | { ok: false; message: string };

/**
 * Reserves a slot and opens a payment order for it.
 *
 * Everything about price is derived server-side from the Pandit's stored rate;
 * the caller supplies only who, what, when and how long.
 */
export async function startConsultationCheckout(input: {
  userId: string;
  userName: string;
  slug: string;
  mode: ConsultationMode;
  start: Date;
  durationMinutes: number;
  birthProfileId?: string | null;
  notes?: string | null;
}): Promise<CheckoutResult> {
  const pandit = await getBookablePandit(input.slug);
  if (!pandit) {
    return { ok: false, message: "This practitioner is not currently taking bookings." };
  }

  const booking = await bookConsultation({
    userId: input.userId,
    panditProfileId: pandit.id,
    mode: input.mode,
    start: input.start,
    durationMinutes: input.durationMinutes,
    birthProfileId: input.birthProfileId ?? null,
    notes: input.notes ?? null,
    // Holds the slot for the length of the checkout, then expires.
    status: ConsultationStatus.PENDING_PAYMENT,
  });

  if (!booking.ok) return { ok: false, message: booking.message };

  if (!isValidMinorUnitAmount(booking.grossAmountPaise)) {
    await releaseHold(booking.consultationId, input.userId);
    return { ok: false, message: "That consultation could not be priced. Please contact support." };
  }

  let providerOrder;
  try {
    providerOrder = await getPaymentProvider().createOrder({
      amountMinor: booking.grossAmountPaise,
      currency: "INR",
      receipt: `consult_${booking.consultationId}`.slice(0, 40),
      notes: { consultationId: booking.consultationId, kind: "consultation" },
    });
  } catch (error) {
    // The hold is released rather than left to expire: a customer who could not
    // reach checkout should not take the slot out of circulation for fifteen
    // minutes.
    await releaseHold(booking.consultationId, input.userId);
    reportIncident("payment_order_failure", { kind: "consultation", slug: input.slug }, error);
    return { ok: false, message: "Payment could not be started. Please try again." };
  }

  await prisma.consultation.update({
    where: { id: booking.consultationId },
    data: { providerOrderId: providerOrder.id },
  });

  const consultation = await prisma.consultation.findUniqueOrThrow({
    where: { id: booking.consultationId },
    select: { scheduledStart: true, durationMinutes: true, mode: true },
  });

  logger.info("consultation_checkout_started", {
    consultationId: booking.consultationId,
    amountMinor: booking.grossAmountPaise,
  });

  return {
    ok: true,
    summary: {
      consultationId: booking.consultationId,
      providerOrderId: providerOrder.id,
      amountMinor: booking.grossAmountPaise,
      currency: booking.currency,
      keyId: getRazorpayPublicKey(),
      panditName: pandit.displayName,
      scheduledStart: consultation.scheduledStart,
      durationMinutes: consultation.durationMinutes,
      mode: consultation.mode,
    },
  };
}

/** Frees a held slot when checkout could not proceed. */
async function releaseHold(consultationId: string, userId: string): Promise<void> {
  await cancelConsultation({
    consultationId,
    actorUserId: userId,
    reason: "Checkout could not be started.",
  }).catch(() => undefined);
}

/**
 * Records a verified payment against a consultation.
 *
 * The single place a consultation becomes CONFIRMED. It is idempotent by
 * construction: a consultation that already carries `paidAt` returns success
 * without writing again, so a browser callback and a webhook arriving for the
 * same payment produce one confirmation rather than two.
 */
export async function applyVerifiedConsultationPayment(
  consultationId: string,
  payment: ProviderPayment,
): Promise<{ ok: true; alreadyPaid: boolean } | { ok: false; message: string }> {
  return prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findUnique({
      where: { id: consultationId },
      select: {
        id: true,
        userId: true,
        status: true,
        paidAt: true,
        grossAmountPaise: true,
        currency: true,
        providerOrderId: true,
      },
    });

    if (!consultation) return { ok: false as const, message: "That booking could not be found." };

    // The provider order must be the one this consultation opened. Without
    // this, a payment for a cheap booking could be presented against an
    // expensive one.
    if (consultation.providerOrderId !== payment.orderId) {
      reportIncident("payment_order_mismatch", { consultationId, providerOrderId: payment.orderId });
      return { ok: false as const, message: "That payment does not belong to this booking." };
    }

    // The provider is authoritative about the amount, and it must match what we
    // priced. A mismatch means the order was tampered with or mis-created.
    if (payment.amountMinor !== consultation.grossAmountPaise) {
      reportIncident("payment_amount_mismatch", {
        consultationId,
        expected: consultation.grossAmountPaise,
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
        consultationId: consultation.id,
        userId: consultation.userId,
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

    if (consultation.paidAt) {
      return { ok: true as const, alreadyPaid: true };
    }

    if (!canTransitionConsultation(consultation.status, ConsultationStatus.CONFIRMED)) {
      // A cancelled or expired hold that is then paid for. The payment is
      // recorded above so it can be refunded, but the booking is not revived -
      // the slot may already belong to somebody else.
      reportIncident("consultation_payment_after_close", {
        consultationId,
        status: consultation.status,
      });
      return {
        ok: false as const,
        message: "This booking is no longer held. Your payment has been recorded for refund.",
      };
    }

    await tx.consultation.update({
      where: { id: consultation.id },
      data: { status: ConsultationStatus.CONFIRMED, paidAt: new Date() },
    });

    logger.info("consultation_confirmed", { consultationId, providerPaymentId: payment.id });

    return { ok: true as const, alreadyPaid: false };
  });
}

/** Records a failed payment without disturbing the booking's hold. */
export async function recordFailedConsultationPayment(
  consultationId: string,
  payment: ProviderPayment,
): Promise<void> {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    select: { userId: true },
  });

  await prisma.payment.upsert({
    where: { providerPaymentId: payment.id },
    create: {
      provider: payment.provider,
      providerOrderId: payment.orderId,
      providerPaymentId: payment.id,
      providerRef: payment.id,
      consultationId,
      userId: consultation?.userId ?? null,
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

  // Deliberately leaves the hold in place: a failed card is usually retried,
  // and taking the slot away mid-retry is a worse experience than letting the
  // hold expire on its own.
  logger.info("consultation_payment_failed", { consultationId, providerPaymentId: payment.id });
}

/** Finds the consultation a provider order belongs to, for webhook routing. */
export async function findConsultationByProviderOrderId(
  providerOrderId: string,
): Promise<{ id: string } | null> {
  return prisma.consultation.findUnique({
    where: { providerOrderId },
    select: { id: true },
  });
}
