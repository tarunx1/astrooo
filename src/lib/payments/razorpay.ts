import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PaymentProviderError,
  PaymentRateLimitError,
  PaymentSignatureError,
  PaymentUnavailableError,
  PaymentValidationError,
} from "@/lib/payments/errors";
import type {
  CreatePaymentOrderInput,
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentOrder,
  VerifyCheckoutSignatureInput,
} from "@/lib/payments/provider";
import { isValidMinorUnitAmount } from "@/lib/payments/provider";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  baseUrl?: string;
};

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: "INR";
  status: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string;
  amount: number;
  currency: "INR";
  status: ProviderPayment["status"];
  captured: boolean;
  created_at?: number;
};

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function signRazorpayPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly baseUrl: string;

  constructor(private readonly config: RazorpayConfig) {
    if (!config.keyId || !config.keySecret) {
      throw new PaymentUnavailableError("Razorpay credentials are missing.");
    }
    this.baseUrl = config.baseUrl ?? "https://api.razorpay.com/v1";
  }

  async createOrder(input: CreatePaymentOrderInput): Promise<ProviderPaymentOrder> {
    if (!isValidMinorUnitAmount(input.amountMinor) || input.currency !== "INR") {
      throw new PaymentValidationError("Invalid Razorpay order amount or currency.");
    }

    const startedAt = Date.now();
    const response = await this.request<RazorpayOrderResponse>("/orders", {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountMinor,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });

    console.info("payment_provider_order_created", {
      provider: "razorpay",
      operation: "orders.create",
      providerOrderId: response.id,
      amountMinor: response.amount,
      currency: response.currency,
      latencyMs: Date.now() - startedAt,
    });

    return {
      provider: "razorpay",
      id: response.id,
      amountMinor: response.amount,
      currency: response.currency,
      status: response.status,
    };
  }

  async fetchPayment(paymentId: string): Promise<ProviderPayment> {
    const payment = await this.request<RazorpayPaymentResponse>(`/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
    });

    return {
      provider: "razorpay",
      id: payment.id,
      orderId: payment.order_id,
      amountMinor: payment.amount,
      currency: payment.currency,
      status: payment.status,
      capturedAt: payment.captured && payment.created_at ? new Date(payment.created_at * 1000) : null,
    };
  }

  verifyPaymentSignature(input: VerifyCheckoutSignatureInput): boolean {
    const payload = `${input.orderId}|${input.paymentId}`;
    const expected = signRazorpayPayload(payload, this.config.keySecret);
    return safeEqual(expected, input.signature);
  }

  verifyWebhookSignature(input: { rawBody: string; signature: string }): boolean {
    if (!this.config.webhookSecret) {
      throw new PaymentUnavailableError("Razorpay webhook secret is missing.");
    }
    const expected = signRazorpayPayload(input.rawBody, this.config.webhookSecret);
    return safeEqual(expected, input.signature);
  }

  async refund(input: { paymentId: string; amountMinor?: number; reason?: string }): Promise<unknown> {
    if (input.amountMinor !== undefined && !isValidMinorUnitAmount(input.amountMinor)) {
      throw new PaymentValidationError("Invalid refund amount.");
    }
    return this.request(`/payments/${encodeURIComponent(input.paymentId)}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amount: input.amountMinor,
        notes: input.reason ? { reason: input.reason } : {},
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.keyId}:${this.config.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 429) throw new PaymentRateLimitError("Razorpay rate limit reached.");

    const body = (await response.json().catch(() => null)) as T | { error?: { description?: string } } | null;
    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? body.error?.description ?? "Razorpay request failed."
          : "Razorpay request failed.";
      throw new PaymentProviderError(message);
    }

    return body as T;
  }
}

export function createRazorpayProvider(config: RazorpayConfig): PaymentProvider {
  return new RazorpayPaymentProvider(config);
}

export function assertRazorpaySignature(input: VerifyCheckoutSignatureInput, secret: string): void {
  const expected = signRazorpayPayload(`${input.orderId}|${input.paymentId}`, secret);
  if (!safeEqual(expected, input.signature)) throw new PaymentSignatureError();
}
