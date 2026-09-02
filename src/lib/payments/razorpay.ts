import type { PaymentProvider } from "@/lib/payments/provider";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
};

export function createRazorpayProvider(config: RazorpayConfig): PaymentProvider {
  void config;
  throw new Error("Razorpay provider is not implemented in Phase 1.");
}
