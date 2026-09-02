export type PaymentCurrency = "INR";

export type CreatePaymentOrderInput = {
  amountMinor: number;
  currency: PaymentCurrency;
  receipt: string;
  notes?: Record<string, string>;
};

export type ProviderPaymentOrder = {
  provider: "razorpay";
  id: string;
  amountMinor: number;
  currency: PaymentCurrency;
  status: string;
};

export type ProviderPayment = {
  provider: "razorpay";
  id: string;
  orderId: string;
  amountMinor: number;
  currency: PaymentCurrency;
  status: "created" | "authorized" | "captured" | "failed" | "refunded" | string;
  capturedAt?: Date | null;
};

export type VerifyCheckoutSignatureInput = {
  orderId: string;
  paymentId: string;
  signature: string;
};

export interface PaymentProvider {
  createOrder(input: CreatePaymentOrderInput): Promise<ProviderPaymentOrder>;
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  verifyPaymentSignature(input: VerifyCheckoutSignatureInput): boolean;
  verifyWebhookSignature(input: { rawBody: string; signature: string }): boolean;
  refund(input: { paymentId: string; amountMinor?: number; reason?: string }): Promise<unknown>;
}

export function isValidMinorUnitAmount(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value <= 10_000_000_00;
}
