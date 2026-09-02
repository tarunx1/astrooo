import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentRateLimitError, PaymentSignatureError, PaymentValidationError } from "@/lib/payments/errors";
import { createRazorpayProvider, signRazorpayPayload, assertRazorpaySignature } from "@/lib/payments/razorpay";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Razorpay payment provider", () => {
  it("verifies checkout signatures with order id from the server", () => {
    const provider = createRazorpayProvider({ keyId: "rzp_test_key", keySecret: "secret" });
    const signature = signRazorpayPayload("order_123|pay_123", "secret");

    expect(provider.verifyPaymentSignature({ orderId: "order_123", paymentId: "pay_123", signature })).toBe(true);
    expect(provider.verifyPaymentSignature({ orderId: "order_attacker", paymentId: "pay_123", signature })).toBe(false);
    expect(() =>
      assertRazorpaySignature({ orderId: "order_123", paymentId: "pay_123", signature: "bad" }, "secret"),
    ).toThrow(PaymentSignatureError);
  });

  it("verifies webhook signatures against the raw body", () => {
    const provider = createRazorpayProvider({
      keyId: "rzp_test_key",
      keySecret: "secret",
      webhookSecret: "webhook-secret",
    });
    const rawBody = "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_1\"}}}}";
    const signature = signRazorpayPayload(rawBody, "webhook-secret");

    expect(provider.verifyWebhookSignature({ rawBody, signature })).toBe(true);
    expect(provider.verifyWebhookSignature({ rawBody: JSON.stringify(JSON.parse(rawBody), null, 2), signature })).toBe(false);
  });

  it("creates Razorpay orders with authoritative minor units and no client price input", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        amount: 79900,
        currency: "INR",
        receipt: "report-order",
        notes: { reportOrderId: "report-order" },
      });
      return Response.json({ id: "order_test", amount: 79900, currency: "INR", status: "created" });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const provider = createRazorpayProvider({ keyId: "rzp_test_key", keySecret: "secret" });
    await expect(
      provider.createOrder({
        amountMinor: 79900,
        currency: "INR",
        receipt: "report-order",
        notes: { reportOrderId: "report-order" },
      }),
    ).resolves.toMatchObject({ id: "order_test", amountMinor: 79900, currency: "INR" });
  });

  it("rejects invalid order amounts before contacting Razorpay", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;
    const provider = createRazorpayProvider({ keyId: "rzp_test_key", keySecret: "secret" });

    await expect(
      provider.createOrder({ amountMinor: 0, currency: "INR", receipt: "bad" }),
    ).rejects.toBeInstanceOf(PaymentValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider rate limiting to a payment-domain error", async () => {
    globalThis.fetch = vi.fn(async () => Response.json({ error: { description: "slow down" } }, { status: 429 })) as typeof fetch;
    const provider = createRazorpayProvider({ keyId: "rzp_test_key", keySecret: "secret" });

    await expect(provider.fetchPayment("pay_123")).rejects.toBeInstanceOf(PaymentRateLimitError);
  });
});
