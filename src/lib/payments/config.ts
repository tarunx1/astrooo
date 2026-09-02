import "server-only";

import { PaymentUnavailableError } from "@/lib/payments/errors";
import type { PaymentProvider } from "@/lib/payments/provider";
import { createRazorpayProvider } from "@/lib/payments/razorpay";

export function isReportCheckoutEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.REPORT_CHECKOUT_ENABLED === "true";
}

export function getRazorpayPublicKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.RAZORPAY_KEY_ID || null;
}

export function getPaymentProvider(env: NodeJS.ProcessEnv = process.env): PaymentProvider {
  if ((env.PAYMENT_PROVIDER ?? "razorpay") !== "razorpay") {
    throw new PaymentUnavailableError("Unsupported payment provider.");
  }

  return createRazorpayProvider({
    keyId: env.RAZORPAY_KEY_ID ?? "",
    keySecret: env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  });
}
