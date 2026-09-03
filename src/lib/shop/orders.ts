import "server-only";

import { randomBytes } from "node:crypto";
import { InventoryStatus, OrderStatus, PaymentStatus, Prisma, ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getPaymentProvider } from "@/lib/payments/config";
import { PaymentValidationError } from "@/lib/payments/errors";
import type { PaymentProvider, ProviderPayment } from "@/lib/payments/provider";
import { isValidMinorUnitAmount } from "@/lib/payments/provider";
import { evaluateCoupon, recordCouponRedemption } from "@/lib/shop/coupons";
import { toAddressSnapshot, type ShippingAddress } from "@/lib/shop/address";
import { composeTotals, getShippingCalculator, getTaxCalculator, lineTotalPaise } from "@/lib/shop/pricing";
import { markCartConverted } from "@/lib/shop/cart";

/**
 * Physical order lifecycle.
 *
 * Inventory strategy: **validate at checkout, decrement atomically after
 * payment** (option B). Reservations are not modelled, and inventing a
 * reservation table with expiry sweeps would add moving parts this phase does
 * not need. The trade-off is a small window where two buyers can both pass
 * checkout validation for the last unit; that is resolved after payment by a
 * guarded decrement which never drives stock negative, and any line that cannot
 * be filled is recorded in `Order.inventoryShortfall` for manual resolution
 * rather than silently oversold.
 *
 * `Order.inventoryCommittedAt` is the idempotency guard: stock is decremented
 * exactly once per order however many times a payment event is delivered.
 */
export type OrderLineDraft = {
  productId: string;
  productVariantId: string | null;
  title: string;
  sku: string | null;
  variantSnapshot: Prisma.InputJsonValue | null;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
};

export type CreateOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      providerOrderId: string;
      amountMinor: number;
      currency: "INR";
    }
  | { ok: false; reason: CreateOrderRejection; message: string };

export type CreateOrderRejection =
  | "empty_cart"
  | "item_unavailable"
  | "insufficient_stock"
  | "invalid_total"
  | "coupon_invalid"
  | "provider_error";

function generateOrderNumber(): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `RA-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function effectiveUnitPrice(base: number, sale: number | null): number {
  return sale !== null && sale > 0 && sale < base ? sale : base;
}

/**
 * Builds the order lines by re-reading every product from the database.
 *
 * Nothing from the cart row except product identity and quantity is used, and
 * nothing from the browser at all. This is where price tampering dies.
 */
async function buildLinesFromCart(cartId: string): Promise<
  | { ok: true; lines: OrderLineDraft[]; subtotalPaise: number }
  | { ok: false; reason: "empty_cart" | "item_unavailable" | "insufficient_stock" }
> {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          sku: true,
          active: true,
          type: true,
          pricePaise: true,
          salePricePaise: true,
          inventory: { select: { quantity: true, status: true } },
        },
      },
      productVariant: {
        select: {
          id: true,
          productId: true,
          title: true,
          sku: true,
          pricePaise: true,
          salePricePaise: true,
          attributes: true,
          inventory: { select: { quantity: true, status: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) return { ok: false, reason: "empty_cart" };

  const lines: OrderLineDraft[] = [];

  for (const item of items) {
    if (!item.product.active || item.product.type !== ProductType.PHYSICAL) {
      return { ok: false, reason: "item_unavailable" };
    }

    // A variant must belong to the product it is attached to.
    if (item.productVariant && item.productVariant.productId !== item.product.id) {
      return { ok: false, reason: "item_unavailable" };
    }

    const usingVariant = item.productVariant !== null;
    const unitPricePaise = usingVariant
      ? effectiveUnitPrice(item.productVariant!.pricePaise ?? item.product.pricePaise, item.productVariant!.salePricePaise)
      : effectiveUnitPrice(item.product.pricePaise, item.product.salePricePaise);

    if (!isValidMinorUnitAmount(unitPricePaise)) return { ok: false, reason: "item_unavailable" };

    const inventory = usingVariant ? item.productVariant!.inventory : item.product.inventory;
    const available = inventory?.status === InventoryStatus.IN_STOCK ? Math.max(0, inventory.quantity) : 0;
    if (item.quantity < 1 || item.quantity > available) return { ok: false, reason: "insufficient_stock" };

    lines.push({
      productId: item.product.id,
      productVariantId: item.productVariant?.id ?? null,
      title: item.product.title,
      sku: item.productVariant?.sku ?? item.product.sku,
      variantSnapshot: item.productVariant
        ? ({ title: item.productVariant.title, sku: item.productVariant.sku, attributes: item.productVariant.attributes ?? null } as Prisma.InputJsonValue)
        : null,
      unitPricePaise,
      quantity: item.quantity,
      lineTotalPaise: lineTotalPaise(unitPricePaise, item.quantity),
    });
  }

  return { ok: true, lines, subtotalPaise: lines.reduce((sum, line) => sum + line.lineTotalPaise, 0) };
}

/** Server-side quote for the checkout summary. Never accepts browser amounts. */
export async function quoteCart(input: {
  cartId: string;
  userId: string;
  couponCode?: string | null;
  countryCode?: string;
}) {
  const built = await buildLinesFromCart(input.cartId);
  if (!built.ok) return { ok: false as const, reason: built.reason };

  const shipping = getShippingCalculator().quote({
    subtotalPaise: built.subtotalPaise,
    countryCode: input.countryCode ?? "IN",
  });

  let discountPaise = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let couponError: string | null = null;

  if (input.couponCode) {
    const evaluation = await evaluateCoupon({
      code: input.couponCode,
      subtotalPaise: built.subtotalPaise,
      userId: input.userId,
    });
    if (evaluation.ok) {
      discountPaise = evaluation.discountPaise;
      couponId = evaluation.couponId;
      couponCode = evaluation.code;
    } else {
      couponError = evaluation.message;
    }
  }

  const tax = getTaxCalculator().calculate({
    subtotalPaise: built.subtotalPaise,
    discountPaise,
    shippingPaise: shipping.shippingPaise,
  });

  const totals = composeTotals({
    subtotalPaise: built.subtotalPaise,
    discountPaise,
    shippingPaise: shipping.shippingPaise,
    taxPaise: tax.taxPaise,
  });

  return { ok: true as const, lines: built.lines, totals, shipping, couponId, couponCode, couponError };
}

/**
 * Creates the internal Order, then the provider order.
 *
 * Order of operations matters: the internal Order and its immutable line
 * snapshots exist and are committed before Razorpay is contacted, so a provider
 * order can never reference an order we did not record.
 */
export async function createOrderFromCart(input: {
  userId: string;
  cartId: string;
  address: ShippingAddress;
  couponCode?: string | null;
  paymentProvider?: PaymentProvider;
}): Promise<CreateOrderResult> {
  const quote = await quoteCart({
    cartId: input.cartId,
    userId: input.userId,
    couponCode: input.couponCode,
    countryCode: input.address.country,
  });

  if (!quote.ok) {
    const messages: Record<string, string> = {
      empty_cart: "Your cart is empty.",
      item_unavailable: "An item in your cart is no longer available.",
      insufficient_stock: "An item in your cart is no longer in stock in that quantity.",
    };
    return { ok: false, reason: quote.reason, message: messages[quote.reason] ?? "Checkout could not continue." };
  }

  if (input.couponCode && quote.couponError) {
    return { ok: false, reason: "coupon_invalid", message: quote.couponError };
  }

  if (!isValidMinorUnitAmount(quote.totals.totalPaise)) {
    return { ok: false, reason: "invalid_total", message: "This order total cannot be processed." };
  }

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: input.userId,
        cartId: input.cartId,
        status: OrderStatus.PENDING_PAYMENT,
        subtotalPaise: quote.totals.subtotalPaise,
        discountPaise: quote.totals.discountPaise,
        shippingPaise: quote.totals.shippingPaise,
        taxPaise: quote.totals.taxPaise,
        totalPaise: quote.totals.totalPaise,
        currency: quote.totals.currency,
        shippingAddress: toAddressSnapshot(input.address) as Prisma.InputJsonValue,
        couponId: quote.couponId,
        couponCodeSnapshot: quote.couponCode,
      },
      select: { id: true, orderNumber: true },
    });

    await tx.orderItem.createMany({
      data: quote.lines.map((line) => ({
        orderId: created.id,
        productId: line.productId,
        productVariantId: line.productVariantId,
        title: line.title,
        skuSnapshot: line.sku,
        variantSnapshot: line.variantSnapshot ?? Prisma.DbNull,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        totalPaise: line.lineTotalPaise,
      })),
    });

    return created;
  });

  try {
    const provider = input.paymentProvider ?? getPaymentProvider();
    const providerOrder = await provider.createOrder({
      amountMinor: quote.totals.totalPaise,
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId: order.id, kind: "physical" },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { providerOrderId: providerOrder.id },
    });

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerOrderId: providerOrder.id,
      amountMinor: quote.totals.totalPaise,
      currency: "INR",
    };
  } catch {
    // The internal order survives so the customer can retry without rebuilding
    // their cart. It simply has no provider order yet.
    return { ok: false, reason: "provider_error", message: "Payment could not be started. Please try again." };
  }
}

/**
 * Applies a verified provider payment to a physical order.
 *
 * Validates provider order, amount and currency against the stored order before
 * anything is written, then transitions Payment and Order together. Safe to
 * call repeatedly: the paid transition and the inventory commit are both
 * guarded.
 */
export async function applyVerifiedOrderPayment(orderId: string, payment: ProviderPayment): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, providerOrderId: true, totalPaise: true, currency: true, paidAt: true, couponId: true, cartId: true },
  });

  if (!order || !order.providerOrderId) throw new PaymentValidationError("Order is not payable.");
  if (payment.orderId !== order.providerOrderId) throw new PaymentValidationError("Provider order mismatch.");
  if (payment.amountMinor !== order.totalPaise) throw new PaymentValidationError("Payment amount mismatch.");
  if (payment.currency !== order.currency) throw new PaymentValidationError("Payment currency mismatch.");

  const captured = payment.status === "captured";

  await prisma.$transaction(async (tx) => {
    await tx.payment.upsert({
      where: { providerPaymentId: payment.id },
      create: {
        userId: order.userId,
        orderId: order.id,
        provider: payment.provider,
        providerOrderId: payment.orderId,
        providerPaymentId: payment.id,
        providerRef: payment.id,
        status: captured ? PaymentStatus.CAPTURED : PaymentStatus.FAILED,
        amountPaise: payment.amountMinor,
        currency: payment.currency,
        capturedAt: captured ? payment.capturedAt ?? new Date() : null,
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
      update: {
        status: captured ? PaymentStatus.CAPTURED : PaymentStatus.FAILED,
        capturedAt: captured ? payment.capturedAt ?? new Date() : undefined,
        rawResponse: payment as unknown as Prisma.InputJsonValue,
      },
    });

    if (!captured) return;

    // Guarded so a duplicate event cannot re-stamp paidAt.
    await tx.order.updateMany({
      where: { id: order.id, paidAt: null },
      data: { status: OrderStatus.PAID, paidAt: payment.capturedAt ?? new Date() },
    });

    if (order.couponId) {
      await recordCouponRedemption(tx as unknown as typeof prisma, {
        couponId: order.couponId,
        userId: order.userId,
        orderId: order.id,
      });
    }
  });

  if (!captured) return;

  await commitInventoryForOrder(order.id);

  if (order.cartId) await markCartConverted(order.cartId);
}

export type InventoryCommitResult = { committed: boolean; shortfall: Array<{ productId: string; variantId: string | null; requested: number }> };

/**
 * Decrements stock for a paid order, exactly once.
 *
 * `inventoryCommittedAt` is claimed with a guarded update inside the
 * transaction: only the first caller sees count === 1, so concurrent or
 * duplicate payment events cannot decrement twice. Each line uses a conditional
 * update requiring `quantity >= requested`, which makes overselling impossible
 * even under races; anything that cannot be filled is recorded rather than
 * driving stock negative.
 */
export async function commitInventoryForOrder(orderId: string): Promise<InventoryCommitResult> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PAID, inventoryCommittedAt: null },
      data: { inventoryCommittedAt: new Date() },
    });

    // Someone else already committed this order's inventory.
    if (claimed.count !== 1) return { committed: false, shortfall: [] };

    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, productVariantId: true, quantity: true },
    });

    const shortfall: InventoryCommitResult["shortfall"] = [];

    for (const item of items) {
      const where = item.productVariantId
        ? { productVariantId: item.productVariantId, quantity: { gte: item.quantity } }
        : { productId: item.productId, quantity: { gte: item.quantity } };

      const updated = await tx.inventory.updateMany({
        where,
        data: { quantity: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        shortfall.push({ productId: item.productId, variantId: item.productVariantId, requested: item.quantity });
        continue;
      }

      // Flip to OUT_OF_STOCK when the last unit goes.
      await tx.inventory.updateMany({
        where: item.productVariantId ? { productVariantId: item.productVariantId, quantity: { lte: 0 } } : { productId: item.productId, quantity: { lte: 0 } },
        data: { status: InventoryStatus.OUT_OF_STOCK },
      });
    }

    if (shortfall.length > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: { inventoryShortfall: shortfall as unknown as Prisma.InputJsonValue },
      });
      console.error("order_inventory_shortfall", { orderId, lines: shortfall.length });
    }

    return { committed: true, shortfall };
  });
}

/** Resolves a provider order id to whichever internal order owns it. */
export async function findOrderByProviderOrderId(providerOrderId: string) {
  return prisma.order.findUnique({ where: { providerOrderId }, select: { id: true } });
}

export type AccountOrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalPaise: number;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
  itemCount: number;
  itemsSummary: string;
};

export async function listAccountOrders(userId: string): Promise<AccountOrderSummary[]> {
  const rows = await prisma.order.findMany({
    where: { userId, status: { not: OrderStatus.DRAFT } },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalPaise: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      items: { select: { title: true, quantity: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    totalPaise: row.totalPaise,
    currency: row.currency,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    itemsSummary: row.items.map((item) => `${item.title} x${item.quantity}`).join(", "),
  }));
}

/** Ownership is scoped in the query, so another user's id resolves to null. */
export async function getOwnedOrder(userId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotalPaise: true,
      discountPaise: true,
      shippingPaise: true,
      taxPaise: true,
      totalPaise: true,
      currency: true,
      couponCodeSnapshot: true,
      shippingAddress: true,
      createdAt: true,
      paidAt: true,
      items: {
        select: {
          id: true,
          title: true,
          skuSnapshot: true,
          variantSnapshot: true,
          quantity: true,
          unitPricePaise: true,
          totalPaise: true,
        },
      },
      payments: {
        select: { id: true, status: true, amountPaise: true, currency: true, capturedAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

