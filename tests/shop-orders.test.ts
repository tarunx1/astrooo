import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CartStatus, InventoryStatus, OrderStatus, PaymentStatus, ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { addToCart, resolveCart } from "@/lib/shop/cart";
import {
  applyVerifiedOrderPayment,
  commitInventoryForOrder,
  createOrderFromCart,
  getOwnedOrder,
  listAccountOrders,
} from "@/lib/shop/orders";
import type { ShippingAddress } from "@/lib/shop/address";
import { shippingAddressSchema } from "@/lib/shop/address";
import { verifyCheckoutPaymentForOrder } from "@/lib/shop/payment-verification";
import type { PaymentProvider, ProviderPayment } from "@/lib/payments/provider";
import { PaymentValidationError } from "@/lib/payments/errors";
import { processRazorpayWebhook } from "@/lib/payments/webhooks";

/**
 * Physical order creation, payment and inventory, against real Postgres.
 */
const RUN = `o${Date.now().toString(36)}`;

const ADDRESS: ShippingAddress = shippingAddressSchema.parse({
  fullName: "Ravish Sharma",
  phone: "9876543210",
  addressLine1: "12 Lake Road",
  addressLine2: "Near the temple",
  city: "Amritsar",
  region: "Punjab",
  postalCode: "143001",
  country: "IN",
});

let providerOrderSequence = 0;

function fakeProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  providerOrderSequence += 1;
  const providerOrderId = `${RUN}_po_${providerOrderSequence}`;

  return {
    async createOrder(input) {
      return { provider: "razorpay", id: providerOrderId, amountMinor: input.amountMinor, currency: "INR", status: "created" };
    },
    async fetchPayment() {
      return capturedPayment(providerOrderId, 0);
    },
    verifyPaymentSignature: () => true,
    verifyWebhookSignature: () => true,
    async refund() {
      return {};
    },
    ...overrides,
  };
}

function capturedPayment(providerOrderId: string, amountMinor: number, id = `${providerOrderId}_pay`): ProviderPayment {
  return {
    provider: "razorpay",
    id,
    orderId: providerOrderId,
    amountMinor,
    currency: "INR",
    status: "captured",
    capturedAt: new Date("2026-09-03T10:00:00.000Z"),
  };
}

let userA: { id: string };
let userB: { id: string };

async function createUser(label: string) {
  return prisma.user.create({
    data: { name: `Order ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

async function createProduct(slug: string, price: number, quantity: number) {
  const product = await prisma.product.create({
    data: {
      slug: `${RUN}-${slug}`,
      title: `Test ${slug}`,
      description: "Test product.",
      type: ProductType.PHYSICAL,
      pricePaise: price,
      sku: `${RUN}-${slug}`.toUpperCase(),
      currency: "INR",
      active: true,
    },
    select: { id: true },
  });
  await prisma.inventory.create({
    data: { productId: product.id, quantity, status: quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK },
  });
  return product.id;
}

/** Builds a cart for a fresh user and turns it into an order. */
async function placeOrder(opts: { price: number; stock: number; quantity: number; label: string }) {
  const user = await createUser(`${opts.label}-${providerOrderSequence}-${Date.now()}`);
  const productId = await createProduct(`${opts.label}-${Date.now()}`, opts.price, opts.stock);
  const cart = await resolveCart({ userId: user.id });

  await addToCart({ userId: user.id }, { productId, quantity: opts.quantity });

  const result = await createOrderFromCart({
    userId: user.id,
    cartId: cart.id,
    address: ADDRESS,
    paymentProvider: fakeProvider(),
  });

  return { user, productId, cartId: cart.id, result };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  userA = await createUser("a");
  userB = await createUser("b");
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { startsWith: `${RUN}.` } }, select: { id: true } });
  const ids = users.map((user) => user.id);

  await prisma.payment.deleteMany({ where: { order: { userId: { in: ids } } } });
  await prisma.orderItem.deleteMany({ where: { order: { userId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { userId: { in: ids } } });
  await prisma.cartItem.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.cart.deleteMany({ where: { userId: { in: ids } } });
  await prisma.inventory.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("order creation", () => {
  it("computes totals on the server and snapshots every line", async () => {
    const { result, user } = await placeOrder({ price: 200_000, stock: 5, quantity: 2, label: "create" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await getOwnedOrder(user.id, result.orderId);
    expect(order).not.toBeNull();
    expect(order!.subtotalPaise).toBe(400_000);
    // Above the free-shipping threshold.
    expect(order!.shippingPaise).toBe(0);
    expect(order!.totalPaise).toBe(400_000);
    expect(order!.orderNumber).toMatch(/^RA-\d{8}-[0-9A-F]{6}$/);

    const item = order!.items[0];
    expect(item.title).toContain("Test");
    expect(item.skuSnapshot).toBeTruthy();
    expect(item.unitPricePaise).toBe(200_000);
    expect(item.totalPaise).toBe(400_000);
  });

  it("adds flat shipping below the free threshold", async () => {
    const { result, user } = await placeOrder({ price: 50_000, stock: 5, quantity: 1, label: "ship" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.shippingPaise).toBe(9_900);
    expect(order!.totalPaise).toBe(59_900);
  });

  it("keeps line snapshots when the product later changes", async () => {
    const { result, user, productId } = await placeOrder({ price: 100_000, stock: 5, quantity: 1, label: "snap" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await prisma.product.update({
      where: { id: productId },
      data: { title: "Renamed After Purchase", pricePaise: 999_000 },
    });

    const order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.items[0].title).not.toBe("Renamed After Purchase");
    expect(order!.items[0].unitPricePaise).toBe(100_000);
    expect(order!.totalPaise).toBe(109_900);
  });

  it("keeps the shipping address as an immutable snapshot", async () => {
    const { result, user } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "addr" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = await getOwnedOrder(user.id, result.orderId);
    const snapshot = order!.shippingAddress as Record<string, string>;
    expect(snapshot.city).toBe("Amritsar");
    expect(snapshot.postalCode).toBe("143001");
  });

  it("refuses an empty cart", async () => {
    const user = await createUser(`empty-${Date.now()}`);
    const cart = await resolveCart({ userId: user.id });

    const result = await createOrderFromCart({
      userId: user.id,
      cartId: cart.id,
      address: ADDRESS,
      paymentProvider: fakeProvider(),
    });

    expect(result).toMatchObject({ ok: false, reason: "empty_cart" });
  });

  it("keeps the internal order when the provider fails, so the customer can retry", async () => {
    const user = await createUser(`provfail-${Date.now()}`);
    const productId = await createProduct(`provfail-${Date.now()}`, 200_000, 5);
    const cart = await resolveCart({ userId: user.id });
    await addToCart({ userId: user.id }, { productId, quantity: 1 });

    const failing = fakeProvider({
      async createOrder() {
        throw new Error("provider down");
      },
    });

    const result = await createOrderFromCart({ userId: user.id, cartId: cart.id, address: ADDRESS, paymentProvider: failing });
    expect(result).toMatchObject({ ok: false, reason: "provider_error" });

    const orders = await listAccountOrders(user.id);
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe(OrderStatus.PENDING_PAYMENT);
  });
});

describe("payment application", () => {
  it("rejects a mismatched amount, currency and provider order", async () => {
    const { result } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "mismatch" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await expect(
      applyVerifiedOrderPayment(result.orderId, capturedPayment(result.providerOrderId, 1)),
    ).rejects.toBeInstanceOf(PaymentValidationError);

    await expect(
      applyVerifiedOrderPayment(result.orderId, { ...capturedPayment(result.providerOrderId, result.amountMinor), currency: "USD" as "INR" }),
    ).rejects.toBeInstanceOf(PaymentValidationError);

    await expect(
      applyVerifiedOrderPayment(result.orderId, capturedPayment("someone-elses-order", result.amountMinor)),
    ).rejects.toBeInstanceOf(PaymentValidationError);
  });

  it("marks the order paid, decrements stock once and converts the cart", async () => {
    const { result, user, productId, cartId } = await placeOrder({ price: 200_000, stock: 5, quantity: 2, label: "paid" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await applyVerifiedOrderPayment(result.orderId, capturedPayment(result.providerOrderId, result.amountMinor));

    const order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.status).toBe(OrderStatus.PAID);
    expect(order!.paidAt).not.toBeNull();

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(3);

    const cart = await prisma.cart.findUnique({ where: { id: cartId }, select: { status: true } });
    expect(cart?.status).toBe(CartStatus.CONVERTED);
  });

  it("is idempotent: a duplicate payment event never decrements stock twice", async () => {
    const { result, user, productId } = await placeOrder({ price: 200_000, stock: 10, quantity: 3, label: "dup" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payment = capturedPayment(result.providerOrderId, result.amountMinor);

    await applyVerifiedOrderPayment(result.orderId, payment);
    await applyVerifiedOrderPayment(result.orderId, payment);
    await applyVerifiedOrderPayment(result.orderId, payment);

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(7);

    const payments = await prisma.payment.findMany({ where: { orderId: result.orderId } });
    expect(payments).toHaveLength(1);

    const items = await prisma.orderItem.findMany({ where: { orderId: result.orderId } });
    expect(items).toHaveLength(1);

    const order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.paidAt?.toISOString()).toBe(payment.capturedAt!.toISOString());
  });

  it("commits inventory exactly once even when called concurrently", async () => {
    const { result, productId } = await placeOrder({ price: 200_000, stock: 10, quantity: 2, label: "race" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await applyVerifiedOrderPayment(result.orderId, capturedPayment(result.providerOrderId, result.amountMinor));

    // Fire several commits at once; only the first may take effect.
    const outcomes = await Promise.all([
      commitInventoryForOrder(result.orderId),
      commitInventoryForOrder(result.orderId),
      commitInventoryForOrder(result.orderId),
    ]);

    expect(outcomes.filter((outcome) => outcome.committed)).toHaveLength(0);

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(8);
  });

  it("decrements exactly once when concurrent commits race from an uncommitted paid order", async () => {
    const { result, productId } = await placeOrder({ price: 200_000, stock: 10, quantity: 4, label: "truerace" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Reach PAID without going through the commit, so the race starts clean.
    await prisma.order.update({
      where: { id: result.orderId },
      data: { status: OrderStatus.PAID, paidAt: new Date(), inventoryCommittedAt: null },
    });

    const outcomes = await Promise.all([
      commitInventoryForOrder(result.orderId),
      commitInventoryForOrder(result.orderId),
      commitInventoryForOrder(result.orderId),
      commitInventoryForOrder(result.orderId),
    ]);

    // Exactly one caller may claim the commit.
    expect(outcomes.filter((outcome) => outcome.committed)).toHaveLength(1);

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(6);
  });

  it("never drives stock negative and records a shortfall instead", async () => {
    const { result, productId } = await placeOrder({ price: 200_000, stock: 3, quantity: 3, label: "short" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Stock disappears between checkout and payment.
    await prisma.inventory.update({ where: { productId }, data: { quantity: 1 } });

    await applyVerifiedOrderPayment(result.orderId, capturedPayment(result.providerOrderId, result.amountMinor));

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(1);

    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      select: { status: true, inventoryShortfall: true, inventoryCommittedAt: true },
    });
    expect(order?.status).toBe(OrderStatus.PAID);
    expect(order?.inventoryCommittedAt).not.toBeNull();
    expect(Array.isArray(order?.inventoryShortfall)).toBe(true);
  });

  it("records a failed payment without paying the order, and allows a retry", async () => {
    const { result, user } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "fail" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const failed: ProviderPayment = {
      ...capturedPayment(result.providerOrderId, result.amountMinor, `${result.providerOrderId}_pay_failed`),
      status: "failed",
      capturedAt: null,
    };
    await applyVerifiedOrderPayment(result.orderId, failed);

    let order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(order!.paidAt).toBeNull();

    // A later successful attempt still works and keeps the failed record.
    await applyVerifiedOrderPayment(
      result.orderId,
      capturedPayment(result.providerOrderId, result.amountMinor, `${result.providerOrderId}_pay_ok`),
    );

    order = await getOwnedOrder(user.id, result.orderId);
    expect(order!.status).toBe(OrderStatus.PAID);

    const payments = await prisma.payment.findMany({ where: { orderId: result.orderId }, select: { status: true } });
    expect(payments).toHaveLength(2);
    expect(payments.map((payment) => payment.status).sort()).toEqual([PaymentStatus.CAPTURED, PaymentStatus.FAILED].sort());
  });
});

describe("checkout callback verification", () => {
  it("refuses to confirm another user's order", async () => {
    const { result } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "callback" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = await verifyCheckoutPaymentForOrder({
      userId: userB.id,
      orderId: result.orderId,
      providerOrderId: result.providerOrderId,
      providerPaymentId: "pay_x",
      signature: "sig",
      paymentProvider: fakeProvider(),
    });

    expect(outcome).toMatchObject({ ok: false });
  });

  it("refuses a provider order that does not match the stored one", async () => {
    const { result, user } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "provmismatch" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const outcome = await verifyCheckoutPaymentForOrder({
      userId: user.id,
      orderId: result.orderId,
      providerOrderId: "not-the-right-order",
      providerPaymentId: "pay_x",
      signature: "sig",
      paymentProvider: fakeProvider(),
    });

    expect(outcome).toMatchObject({ ok: false });
  });
});

describe("account order access", () => {
  it("lists only the user's own orders", async () => {
    const { result, user } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "list" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const mine = await listAccountOrders(user.id);
    expect(mine.map((order) => order.id)).toContain(result.orderId);

    const theirs = await listAccountOrders(userA.id);
    expect(theirs.map((order) => order.id)).not.toContain(result.orderId);
  });

  it("refuses another user's order detail as not found", async () => {
    const { result } = await placeOrder({ price: 200_000, stock: 5, quantity: 1, label: "detail" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await expect(getOwnedOrder(userB.id, result.orderId)).resolves.toBeNull();
    await expect(getOwnedOrder(userA.id, result.orderId)).resolves.toBeNull();
  });
});

describe("webhook routing for physical orders", () => {
  function webhookBody(event: string, payment: ProviderPayment) {
    return JSON.stringify({
      event,
      id: `evt_${payment.id}`,
      payload: {
        payment: {
          entity: {
            id: payment.id,
            order_id: payment.orderId,
            amount: payment.amountMinor,
            currency: payment.currency,
            status: payment.status,
            captured: payment.status === "captured",
            created_at: Math.floor(Date.now() / 1000),
          },
        },
      },
    });
  }

  it("routes a captured payment to the physical order and decrements stock once", async () => {
    const { result, productId } = await placeOrder({ price: 200_000, stock: 6, quantity: 2, label: "webhook" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payment = capturedPayment(result.providerOrderId, result.amountMinor, `${result.providerOrderId}_wh`);
    const body = webhookBody("payment.captured", payment);

    const first = await processRazorpayWebhook(body, "sig", `evt_${payment.id}`, fakeProvider());
    expect(first).toEqual({ ok: true, duplicate: false });

    const order = await prisma.order.findUnique({ where: { id: result.orderId }, select: { status: true } });
    expect(order?.status).toBe(OrderStatus.PAID);

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(4);
  });

  it("acknowledges a duplicate delivery without decrementing again", async () => {
    const { result, productId } = await placeOrder({ price: 200_000, stock: 6, quantity: 2, label: "webhookdup" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payment = capturedPayment(result.providerOrderId, result.amountMinor, `${result.providerOrderId}_whd`);
    const body = webhookBody("payment.captured", payment);
    const eventId = `evt_${payment.id}`;

    await processRazorpayWebhook(body, "sig", eventId, fakeProvider());
    const second = await processRazorpayWebhook(body, "sig", eventId, fakeProvider());

    // The event is recognised as already seen.
    expect(second).toEqual({ ok: true, duplicate: true });

    const inventory = await prisma.inventory.findUnique({ where: { productId }, select: { quantity: true } });
    expect(inventory?.quantity).toBe(4);
  });

  it("records a failed webhook payment without paying the order", async () => {
    const { result } = await placeOrder({ price: 200_000, stock: 6, quantity: 1, label: "webhookfail" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const payment: ProviderPayment = {
      ...capturedPayment(result.providerOrderId, result.amountMinor, `${result.providerOrderId}_whf`),
      status: "failed",
    };

    await processRazorpayWebhook(webhookBody("payment.failed", payment), "sig", `evt_${payment.id}`, fakeProvider());

    const order = await prisma.order.findUnique({ where: { id: result.orderId }, select: { status: true } });
    expect(order?.status).toBe(OrderStatus.PENDING_PAYMENT);

    const recorded = await prisma.payment.findUnique({ where: { providerPaymentId: payment.id }, select: { status: true } });
    expect(recorded?.status).toBe(PaymentStatus.FAILED);
  });

  it("rejects a bad signature before parsing the body", async () => {
    const rejecting = fakeProvider({ verifyWebhookSignature: () => false });
    await expect(processRazorpayWebhook("{not json", "bad-sig", "evt_x", rejecting)).rejects.toThrow();
  });
});
