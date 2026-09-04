import "server-only";

import { PaymentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/config";
import { PaymentSignatureError } from "@/lib/payments/errors";
import { applyVerifiedProviderPayment, markProviderOrderPaid } from "@/lib/reports/orders";
import { applyVerifiedOrderPayment, findOrderByProviderOrderId } from "@/lib/shop/orders";
import type { PaymentProvider, ProviderPayment } from "@/lib/payments/provider";
import { logger, reportIncident } from "@/lib/observability/logger";

type RazorpayWebhookPayload = {
  event?: string;
  id?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: "INR";
        status?: ProviderPayment["status"];
        captured?: boolean;
        created_at?: number;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
      };
    };
  };
};

export type WebhookProcessingResult = { ok: true; duplicate: boolean } | { ok: false; status: number };

function providerPaymentFromPayload(payload: RazorpayWebhookPayload): ProviderPayment | null {
  const entity = payload.payload?.payment?.entity;
  if (!entity?.id || !entity.order_id || !entity.amount || entity.currency !== "INR" || !entity.status) return null;
  return {
    provider: "razorpay",
    id: entity.id,
    orderId: entity.order_id,
    amountMinor: entity.amount,
    currency: entity.currency,
    status: entity.status,
    capturedAt: entity.captured && entity.created_at ? new Date(entity.created_at * 1000) : null,
  };
}

export async function processRazorpayWebhook(
  rawBody: string,
  signature: string,
  eventId?: string | null,
  paymentProvider?: PaymentProvider,
): Promise<WebhookProcessingResult> {
  const provider = paymentProvider ?? getPaymentProvider();
  if (!provider.verifyWebhookSignature({ rawBody, signature })) {
    // Worth an incident, not just a 401: a burst of these means either a
    // misconfigured secret after a deploy or someone posting forged events at
    // the endpoint. Neither should be discoverable only by reading access logs.
    reportIncident("payment_signature_failure", { provider: "razorpay", source: "webhook" });
    throw new PaymentSignatureError();
  }

  const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  const providerEventId = eventId || payload.id;
  const eventType = payload.event;
  if (!providerEventId || !eventType) return { ok: false, status: 400 };

  try {
    await prisma.paymentWebhookEvent.create({
      data: {
        provider: "razorpay",
        providerEventId,
        eventType,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      // The unique constraint on providerEventId is the replay guard. Reaching
      // it is normal (providers retry until acknowledged), so this is recorded
      // rather than raised.
      logger.info("payment_webhook_duplicate", { provider: "razorpay", eventType, providerEventId });
      return { ok: true, duplicate: true };
    }
    reportIncident("payment_webhook_failure", { provider: "razorpay", eventType, providerEventId }, error);
    throw error;
  }

  if (eventType === "payment.captured" || eventType === "payment.failed") {
    const payment = providerPaymentFromPayload(payload);

    // One endpoint serves both purchase kinds. The provider order id decides
    // which internal order owns this payment; a physical order is handled by the
    // shop pipeline and a report order by the report pipeline.
    const physicalOrder = payment ? await findOrderByProviderOrderId(payment.orderId) : null;

    if (payment && physicalOrder) {
      if (eventType === "payment.failed") {
        await prisma.payment.upsert({
          where: { providerPaymentId: payment.id },
          create: {
            provider: payment.provider,
            providerOrderId: payment.orderId,
            providerPaymentId: payment.id,
            providerRef: payment.id,
            orderId: physicalOrder.id,
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
      } else {
        await applyVerifiedOrderPayment(physicalOrder.id, payment);
      }

      await prisma.paymentWebhookEvent.update({
        where: { providerEventId },
        data: { processedAt: new Date() },
      });

      logger.info("payment_webhook_processed", { provider: "razorpay", eventType, providerEventId, kind: "physical" });
      return { ok: true, duplicate: false };
    }

    const reportOrder = payment
      ? await prisma.reportOrder.findUnique({
          where: { providerOrderId: payment.orderId },
          select: { id: true },
        })
      : null;

    if (payment && reportOrder) {
      if (eventType === "payment.failed") {
        await prisma.payment.upsert({
          where: { providerPaymentId: payment.id },
          create: {
            provider: payment.provider,
            providerOrderId: payment.orderId,
            providerPaymentId: payment.id,
            providerRef: payment.id,
            reportOrderId: reportOrder.id,
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
      } else {
        await applyVerifiedProviderPayment(reportOrder.id, payment);
      }
    }
  }

  if (eventType === "order.paid") {
    const providerOrderId = payload.payload?.order?.entity?.id;
    if (providerOrderId) {
      // order.paid carries no payment entity, so it can only confirm what a
      // captured payment already recorded. Physical orders are already moved to
      // PAID by payment.captured; nothing further is needed for them here.
      const physical = await findOrderByProviderOrderId(providerOrderId);
      if (!physical) await markProviderOrderPaid(providerOrderId);
    }
  }

  await prisma.paymentWebhookEvent.update({
    where: { providerEventId },
    data: { processedAt: new Date() },
  });

  logger.info("payment_webhook_processed", {
    provider: "razorpay",
    eventType,
    providerEventId,
  });

  return { ok: true, duplicate: false };
}
