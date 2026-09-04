"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { PaymentSignatureError, PaymentValidationError } from "@/lib/payments/errors";
import { verifyCheckoutPaymentForUser } from "@/lib/reports/orders";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";

const paymentResponseSchema = z.object({
  razorpay_order_id: z.string().min(1).max(128),
  razorpay_payment_id: z.string().min(1).max(128),
  razorpay_signature: z.string().min(32).max(256),
});

export async function verifyReportPaymentAction(
  reportOrderId: string,
  payload: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again." };

  const parsed = paymentResponseSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Payment response could not be validated." };

  // Signature verification must not be an unbounded oracle.
  const limit = await checkRateLimit({ namespace: "payment:verify", identifier: `user:${user.id}` });
  if (!limit.allowed) return { ok: false, message: rateLimitMessage(limit.retryAfterSeconds) };

  try {
    return await verifyCheckoutPaymentForUser({
      userId: user.id,
      reportOrderId,
      providerOrderId: parsed.data.razorpay_order_id,
      providerPaymentId: parsed.data.razorpay_payment_id,
      signature: parsed.data.razorpay_signature,
    });
  } catch (error) {
    if (error instanceof PaymentSignatureError) {
      return { ok: false, message: "Payment signature verification failed." };
    }
    if (error instanceof PaymentValidationError) {
      return { ok: false, message: "Payment could not be matched to this order." };
    }
    return { ok: false, message: "Payment verification failed. Please try again." };
  }
}
