import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/config";
import { PaymentSignatureError } from "@/lib/payments/errors";
import type { PaymentProvider } from "@/lib/payments/provider";
import { applyVerifiedOrderPayment } from "@/lib/shop/orders";

/**
 * Browser checkout callback verification for a physical order.
 *
 * Reuses the existing RazorpayPaymentProvider: no crypto is reimplemented here.
 * The order is matched by id *and* userId, so one customer cannot confirm
 * another's order, and the provider order id must match what we recorded.
 */
export async function verifyCheckoutPaymentForOrder(input: {
  userId: string;
  orderId: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  paymentProvider?: PaymentProvider;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, userId: input.userId },
    select: { id: true, providerOrderId: true },
  });

  if (!order || !order.providerOrderId || order.providerOrderId !== input.providerOrderId) {
    return { ok: false, message: "Payment could not be matched to this order." };
  }

  const provider = input.paymentProvider ?? getPaymentProvider();

  if (
    !provider.verifyPaymentSignature({
      orderId: input.providerOrderId,
      paymentId: input.providerPaymentId,
      signature: input.signature,
    })
  ) {
    throw new PaymentSignatureError();
  }

  // The payment is re-fetched from the provider rather than trusted from the
  // browser, so amount, currency and status all come from the source of truth.
  const payment = await provider.fetchPayment(input.providerPaymentId);
  await applyVerifiedOrderPayment(order.id, payment);

  return { ok: true };
}
