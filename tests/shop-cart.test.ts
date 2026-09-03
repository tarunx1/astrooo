import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CartStatus, InventoryStatus, ProductType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  MAX_LINE_QUANTITY,
  addToCart,
  getCartView,
  mergeAnonymousCart,
  removeCartItem,
  resolveCart,
  updateCartItemQuantity,
} from "@/lib/shop/cart";
import { createCartToken, hashCartToken, isValidCartToken } from "@/lib/shop/cart-token";
import { composeTotals, FlatRateShippingCalculator, SHIPPING_POLICY, ZeroTaxCalculator } from "@/lib/shop/pricing";
import { evaluateCoupon } from "@/lib/shop/coupons";

/** Cart, pricing and coupon behaviour against the real schema. */
const RUN = `c${Date.now().toString(36)}`;

let userA: { id: string };
let userB: { id: string };
let productId: string;
let variantProductId: string;
let variantSmallId: string;
let variantLargeId: string;
let inactiveProductId: string;
let outOfStockProductId: string;

async function createUser(label: string) {
  return prisma.user.create({
    data: { name: `Cart ${label}`, email: `${RUN}.${label}@example.test`, emailVerified: true },
    select: { id: true },
  });
}

async function createProduct(opts: { slug: string; price: number; quantity: number; active?: boolean }) {
  const product = await prisma.product.create({
    data: {
      slug: `${RUN}-${opts.slug}`,
      title: `Test ${opts.slug}`,
      description: "Test product.",
      type: ProductType.PHYSICAL,
      pricePaise: opts.price,
      currency: "INR",
      active: opts.active ?? true,
    },
    select: { id: true },
  });

  await prisma.inventory.create({
    data: {
      productId: product.id,
      quantity: opts.quantity,
      status: opts.quantity > 0 ? InventoryStatus.IN_STOCK : InventoryStatus.OUT_OF_STOCK,
    },
  });

  return product.id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  userA = await createUser("a");
  userB = await createUser("b");

  productId = await createProduct({ slug: "gem", price: 100_000, quantity: 10 });
  inactiveProductId = await createProduct({ slug: "hidden", price: 50_000, quantity: 5, active: false });
  outOfStockProductId = await createProduct({ slug: "sold-out", price: 50_000, quantity: 0 });

  variantProductId = await createProduct({ slug: "bracelet", price: 120_000, quantity: 0 });
  const small = await prisma.productVariant.create({
    data: { productId: variantProductId, title: "Small", sku: `${RUN}-BR-S`, pricePaise: 120_000 },
    select: { id: true },
  });
  const large = await prisma.productVariant.create({
    data: { productId: variantProductId, title: "Large", sku: `${RUN}-BR-L`, pricePaise: 140_000 },
    select: { id: true },
  });
  variantSmallId = small.id;
  variantLargeId = large.id;

  await prisma.inventory.create({
    data: { productVariantId: variantSmallId, quantity: 5, status: InventoryStatus.IN_STOCK },
  });
  await prisma.inventory.create({
    data: { productVariantId: variantLargeId, quantity: 5, status: InventoryStatus.IN_STOCK },
  });
});

afterAll(async () => {
  await prisma.cartItem.deleteMany({ where: { product: { slug: { startsWith: RUN } } } });
  await prisma.cart.deleteMany({ where: { OR: [{ userId: { in: [userA.id, userB.id] } }, { sessionId: { not: null } }] } });
  await prisma.inventory.deleteMany({ where: { OR: [{ product: { slug: { startsWith: RUN } } }, { productVariant: { sku: { startsWith: RUN } } }] } });
  await prisma.productVariant.deleteMany({ where: { sku: { startsWith: RUN } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: RUN } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: RUN.toUpperCase() } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  await prisma.$disconnect();
});

describe("cart token", () => {
  it("mints opaque tokens and stores only their digest", () => {
    const token = createCartToken();
    expect(isValidCartToken(token)).toBe(true);
    expect(hashCartToken(token)).toHaveLength(64);
    expect(hashCartToken(token)).not.toContain(token);
  });

  it("rejects malformed tokens", () => {
    expect(isValidCartToken("")).toBe(false);
    expect(isValidCartToken("short")).toBe(false);
    expect(isValidCartToken("../../etc/passwd")).toBe(false);
    expect(isValidCartToken(undefined)).toBe(false);
  });
});

describe("anonymous cart", () => {
  it("holds items against a cookie token", async () => {
    const token = createCartToken();
    const added = await addToCart({ token }, { productId, quantity: 2 });
    expect(added.ok).toBe(true);

    const view = await getCartView({ token });
    expect(view.lines).toHaveLength(1);
    expect(view.itemCount).toBe(2);
    expect(view.subtotalPaise).toBe(200_000);
  });

  it("is not readable with a different token", async () => {
    const token = createCartToken();
    await addToCart({ token }, { productId, quantity: 1 });

    const other = await getCartView({ token: createCartToken() });
    expect(other.lines).toHaveLength(0);
  });
});

describe("authenticated cart", () => {
  it("prices every line from the database, not from the stored row", async () => {
    const priceProduct = await createProduct({ slug: `reprice-${Date.now()}`, price: 100_000, quantity: 5 });
    await addToCart({ userId: userA.id }, { productId: priceProduct, quantity: 2 });

    const before = await getCartView({ userId: userA.id });
    const beforeLine = before.lines.find((line) => line.productId === priceProduct);
    expect(beforeLine?.unitPricePaise).toBe(100_000);

    // Change the catalogue price; the cart must follow it.
    await prisma.product.update({ where: { id: priceProduct }, data: { pricePaise: 130_000 } });

    const after = await getCartView({ userId: userA.id });
    const afterLine = after.lines.find((line) => line.productId === priceProduct);
    expect(afterLine?.unitPricePaise).toBe(130_000);
    expect(afterLine?.lineTotalPaise).toBe(260_000);

    await removeCartItem({ userId: userA.id }, afterLine!.itemId);
  });

  it("refuses an inactive product", async () => {
    const result = await addToCart({ userId: userA.id }, { productId: inactiveProductId, quantity: 1 });
    expect(result).toMatchObject({ ok: false, reason: "product_unavailable" });
  });

  it("refuses an out-of-stock product", async () => {
    const result = await addToCart({ userId: userA.id }, { productId: outOfStockProductId, quantity: 1 });
    expect(result).toMatchObject({ ok: false, reason: "insufficient_stock" });
  });

  it("refuses more than available stock", async () => {
    const result = await addToCart({ userId: userA.id }, { productId, quantity: 999 });
    expect(result).toMatchObject({ ok: false, reason: "invalid_quantity" });

    const overStock = await addToCart({ userId: userA.id }, { productId, quantity: 11 });
    expect(overStock).toMatchObject({ ok: false, reason: "insufficient_stock" });
  });

  it("refuses a variant that belongs to another product", async () => {
    const result = await addToCart(
      { userId: userA.id },
      { productId, productVariantId: variantSmallId, quantity: 1 },
    );
    expect(result).toMatchObject({ ok: false, reason: "variant_invalid" });
  });

  it("keeps different variants as separate lines", async () => {
    const user = await createUser(`variants-${Date.now()}`);

    await addToCart({ userId: user.id }, { productId: variantProductId, productVariantId: variantSmallId, quantity: 1 });
    await addToCart({ userId: user.id }, { productId: variantProductId, productVariantId: variantLargeId, quantity: 1 });

    const view = await getCartView({ userId: user.id });
    expect(view.lines).toHaveLength(2);
    expect(view.lines.map((line) => line.productVariantId).sort()).toEqual([variantSmallId, variantLargeId].sort());
    // Variant prices are used, not the parent product price.
    expect(view.subtotalPaise).toBe(120_000 + 140_000);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("combines the same product and variant into one line", async () => {
    const user = await createUser(`combine-${Date.now()}`);

    await addToCart({ userId: user.id }, { productId, quantity: 2 });
    await addToCart({ userId: user.id }, { productId, quantity: 3 });

    const view = await getCartView({ userId: user.id });
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0].quantity).toBe(5);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("does not let one user mutate another user's line", async () => {
    const user = await createUser(`isolate-${Date.now()}`);
    await addToCart({ userId: user.id }, { productId, quantity: 1 });
    const view = await getCartView({ userId: user.id });
    const itemId = view.lines[0].itemId;

    const hijackUpdate = await updateCartItemQuantity({ userId: userB.id }, { itemId, quantity: 5 });
    expect(hijackUpdate).toMatchObject({ ok: false, reason: "not_found" });

    const hijackRemove = await removeCartItem({ userId: userB.id }, itemId);
    expect(hijackRemove).toMatchObject({ ok: false, reason: "not_found" });

    const unchanged = await getCartView({ userId: user.id });
    expect(unchanged.lines[0].quantity).toBe(1);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("cart merge on sign-in", () => {
  it("combines matching lines, keeps variants separate and clamps to stock", async () => {
    const user = await createUser(`merge-${Date.now()}`);
    const token = createCartToken();

    // Signed-in cart already has 2 of the product and a small bracelet.
    await addToCart({ userId: user.id }, { productId, quantity: 2 });
    await addToCart({ userId: user.id }, { productId: variantProductId, productVariantId: variantSmallId, quantity: 1 });

    // Anonymous cart has 3 more of the product and a large bracelet.
    await addToCart({ token }, { productId, quantity: 3 });
    await addToCart({ token }, { productId: variantProductId, productVariantId: variantLargeId, quantity: 1 });

    const merged = await mergeAnonymousCart(user.id, token);
    expect(merged.merged).toBe(2);

    const view = await getCartView({ userId: user.id });
    const plain = view.lines.find((line) => line.productId === productId && line.productVariantId === null);
    expect(plain?.quantity).toBe(5);
    expect(view.lines.filter((line) => line.productId === variantProductId)).toHaveLength(2);

    // The anonymous cart is retired, so a second merge is a no-op.
    const again = await mergeAnonymousCart(user.id, token);
    expect(again.merged).toBe(0);

    const anonCart = await prisma.cart.findFirst({ where: { sessionId: hashCartToken(token) }, select: { status: true } });
    expect(anonCart?.status).toBe(CartStatus.CONVERTED);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("never merges beyond the line maximum", async () => {
    const user = await createUser(`clamp-${Date.now()}`);
    const bulk = await createProduct({ slug: `bulk-${Date.now()}`, price: 10_000, quantity: 100 });
    const token = createCartToken();

    await addToCart({ userId: user.id }, { productId: bulk, quantity: MAX_LINE_QUANTITY });
    await addToCart({ token }, { productId: bulk, quantity: MAX_LINE_QUANTITY });

    await mergeAnonymousCart(user.id, token);

    const view = await getCartView({ userId: user.id });
    expect(view.lines[0].quantity).toBe(MAX_LINE_QUANTITY);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("pricing", () => {
  it("charges flat shipping below the free threshold and nothing above it", () => {
    const calculator = new FlatRateShippingCalculator();

    expect(calculator.quote({ subtotalPaise: 100_000, countryCode: "IN" }).shippingPaise).toBe(
      SHIPPING_POLICY.flatRatePaise,
    );
    expect(calculator.quote({ subtotalPaise: SHIPPING_POLICY.freeAboveSubtotalPaise, countryCode: "IN" }).shippingPaise).toBe(0);
  });

  it("applies no tax while tax is unconfigured", () => {
    expect(new ZeroTaxCalculator().calculate()).toEqual({ taxPaise: 0 });
  });

  it("composes totals as integers and never goes negative", () => {
    const totals = composeTotals({ subtotalPaise: 100_000, discountPaise: 250_000, shippingPaise: 9_900, taxPaise: 0 });

    // The discount is clamped to the subtotal.
    expect(totals.discountPaise).toBe(100_000);
    expect(totals.totalPaise).toBe(9_900);
    expect(Number.isInteger(totals.totalPaise)).toBe(true);
  });
});

describe("coupons", () => {
  async function makeCoupon(suffix: string, data: Record<string, unknown>) {
    return prisma.coupon.create({
      data: { code: `${RUN.toUpperCase()}${suffix}`, active: true, ...data },
      select: { code: true },
    });
  }

  it("applies a fixed discount", async () => {
    const coupon = await makeCoupon("FIXED", { amountOffPaise: 20_000 });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discountPaise).toBe(20_000);
  });

  it("applies a percentage discount and honours the cap", async () => {
    const coupon = await makeCoupon("PCT", { percentOff: 50, maxDiscountPaise: 30_000 });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discountPaise).toBe(30_000);
  });

  it("rejects below the minimum order value", async () => {
    const coupon = await makeCoupon("MIN", { amountOffPaise: 10_000, minOrderPaise: 200_000 });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id });

    expect(result).toMatchObject({ ok: false, reason: "below_minimum" });
  });

  it("rejects an expired coupon", async () => {
    const coupon = await makeCoupon("EXP", {
      amountOffPaise: 10_000,
      endsAt: new Date(Date.now() - 86_400_000),
    });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id });

    expect(result).toMatchObject({ ok: false, reason: "expired" });
  });

  it("rejects an inactive coupon and an unknown code", async () => {
    const coupon = await makeCoupon("OFF", { amountOffPaise: 10_000, active: false });
    await expect(evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id })).resolves.toMatchObject({
      ok: false,
      reason: "inactive",
    });
    await expect(evaluateCoupon({ code: "NOPE-NOT-REAL", subtotalPaise: 100_000, userId: userA.id })).resolves.toMatchObject({
      ok: false,
      reason: "not_found",
    });
  });

  it("rejects once the global usage limit is reached", async () => {
    const coupon = await makeCoupon("LIMIT", { amountOffPaise: 10_000, usageLimit: 1, timesRedeemed: 1 });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 100_000, userId: userA.id });

    expect(result).toMatchObject({ ok: false, reason: "usage_limit" });
  });

  it("never discounts more than the subtotal", async () => {
    const coupon = await makeCoupon("HUGE", { amountOffPaise: 999_999_99 });
    const result = await evaluateCoupon({ code: coupon.code, subtotalPaise: 50_000, userId: userA.id });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.discountPaise).toBe(50_000);
  });
});

describe("cart lifecycle", () => {
  it("creates one active cart per owner", async () => {
    const user = await createUser(`single-${Date.now()}`);
    const first = await resolveCart({ userId: user.id });
    const second = await resolveCart({ userId: user.id });

    expect(second.id).toBe(first.id);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("removes a line when quantity is set to zero", async () => {
    const user = await createUser(`zero-${Date.now()}`);
    await addToCart({ userId: user.id }, { productId, quantity: 2 });
    const view = await getCartView({ userId: user.id });

    await updateCartItemQuantity({ userId: user.id }, { itemId: view.lines[0].itemId, quantity: 0 });
    const after = await getCartView({ userId: user.id });
    expect(after.lines).toHaveLength(0);

    await prisma.cart.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
