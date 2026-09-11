"use server";

import { revalidatePath } from "next/cache";
import { PujaMode } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import {
  sankalpSchema,
  startPujaCheckout,
  verifyPujaPayment,
  type PujaCheckoutSummary,
} from "@/lib/puja/bookings";

/**
 * Puja booking actions.
 *
 * The Sankalp arrives here and goes straight into the booking row. It is never
 * echoed back in an action result, never logged and never put in an audit
 * entry - it is private customer data of the same kind as a birth profile.
 */
export type PujaCheckoutActionResult =
  | { ok: true; summary: PujaCheckoutSummary }
  | { ok: false; message: string; needsAuth?: boolean };

export async function startPujaBookingAction(input: {
  slug: string;
  mode: string;
  requestedDate: string | null;
  sankalp: unknown;
}): Promise<PujaCheckoutActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, message: "Sign in to book this puja." };

  const decision = await checkRateLimit({ namespace: "booking:create", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const parsed = z
    .object({
      slug: z.string().trim().min(1).max(120),
      mode: z.nativeEnum(PujaMode),
      requestedDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      sankalp: sankalpSchema,
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Check the details you entered and try again." };
  }

  const result = await startPujaCheckout({
    userId: user.id,
    slug: parsed.data.slug,
    mode: parsed.data.mode,
    requestedDate: parsed.data.requestedDate,
    sankalp: parsed.data.sankalp,
  });

  if (!result.ok) return { ok: false, message: result.message };

  return { ok: true, summary: result.summary };
}

export async function verifyPujaPaymentAction(
  bookingId: string,
  response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to complete your booking." };

  const decision = await checkRateLimit({ namespace: "payment:verify", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const result = await verifyPujaPayment({
    bookingId,
    userId: user.id,
    orderId: response.razorpay_order_id,
    paymentId: response.razorpay_payment_id,
    signature: response.razorpay_signature,
  });

  if (!result.ok) return result;

  revalidatePath("/account/puja");
  return { ok: true };
}
