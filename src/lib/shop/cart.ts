import "server-only";

import { CartStatus, InventoryStatus, ProductType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashCartToken } from "@/lib/shop/cart-token";
import { CURRENCY, lineTotalPaise } from "@/lib/shop/pricing";

/**
 * Cart service.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. Prices are always read from the database at read time. A CartItem stores a
 *    product reference and a quantity, never a price, so a stale or tampered
 *    browser value can never influence a total.
 * 2. Ownership is scoped inside the query. A cart is reachable only by its
 *    owning userId or by the hash of its anonymous cookie token.
 */
export const MAX_LINE_QUANTITY = 20;

export type CartLine = {
  itemId: string;
  productId: string;
  productVariantId: string | null;
  slug: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  /** Stock actually available for this line right now. */
  availableQuantity: number;
  inStock: boolean;
  /** True when the line exceeds available stock and must be reduced. */
  exceedsStock: boolean;
};

export type CartView = {
  cartId: string | null;
  lines: CartLine[];
  subtotalPaise: number;
  itemCount: number;
  currency: typeof CURRENCY;
  hasUnavailableLines: boolean;
};

export const EMPTY_CART: CartView = {
  cartId: null,
  lines: [],
  subtotalPaise: 0,
  itemCount: 0,
  currency: CURRENCY,
  hasUnavailableLines: false,
};

export type CartOwner = { userId: string } | { token: string } | { userId: string; token: string };

function ownerWhere(owner: CartOwner): Prisma.CartWhereInput {
  if ("userId" in owner && owner.userId) {
    return { userId: owner.userId, status: CartStatus.ACTIVE };
  }
  return { sessionId: hashCartToken((owner as { token: string }).token), status: CartStatus.ACTIVE };
}

/** Resolves the caller's active cart without creating one. */
export async function findActiveCart(owner: CartOwner): Promise<{ id: string } | null> {
  return prisma.cart.findFirst({ where: ownerWhere(owner), select: { id: true }, orderBy: { updatedAt: "desc" } });
}

/** Resolves or creates the caller's active cart. */
export async function resolveCart(owner: CartOwner): Promise<{ id: string }> {
  const existing = await findActiveCart(owner);
  if (existing) return existing;

  const userId = "userId" in owner ? owner.userId : null;
  const token = "token" in owner ? owner.token : null;

  return prisma.cart.create({
    data: {
      userId: userId ?? null,
      sessionId: token ? hashCartToken(token) : null,
      status: CartStatus.ACTIVE,
    },
    select: { id: true },
  });
}

const LINE_INCLUDE = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      sku: true,
      active: true,
      type: true,
      pricePaise: true,
      salePricePaise: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      inventory: { select: { quantity: true, status: true } },
    },
  },
  productVariant: {
    select: {
      id: true,
      title: true,
      sku: true,
      pricePaise: true,
      salePricePaise: true,
      attributes: true,
      productId: true,
      inventory: { select: { quantity: true, status: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

type LineRow = Prisma.CartItemGetPayload<{ include: typeof LINE_INCLUDE }>;

/** Effective unit price: a genuine sale price wins, otherwise list price. */
function effectiveUnitPrice(base: number, sale: number | null): number {
  return sale !== null && sale > 0 && sale < base ? sale : base;
}

function toLine(row: LineRow): CartLine | null {
  // An inactive or non-physical product is silently dropped rather than priced.
  if (!row.product.active || row.product.type !== ProductType.PHYSICAL) return null;

  const usingVariant = row.productVariant !== null;
  const unitPricePaise = usingVariant
    ? effectiveUnitPrice(row.productVariant!.pricePaise ?? row.product.pricePaise, row.productVariant!.salePricePaise)
    : effectiveUnitPrice(row.product.pricePaise, row.product.salePricePaise);

  const inventory = usingVariant ? row.productVariant!.inventory : row.product.inventory;
  const availableQuantity =
    inventory?.status === InventoryStatus.IN_STOCK ? Math.max(0, inventory.quantity) : 0;

  return {
    itemId: row.id,
    productId: row.product.id,
    productVariantId: row.productVariant?.id ?? null,
    slug: row.product.slug,
    title: row.product.title,
    variantTitle: row.productVariant?.title ?? null,
    sku: row.productVariant?.sku ?? row.product.sku,
    imageUrl: row.product.images[0]?.url ?? null,
    unitPricePaise,
    quantity: row.quantity,
    lineTotalPaise: lineTotalPaise(unitPricePaise, row.quantity),
    availableQuantity,
    inStock: availableQuantity > 0,
    exceedsStock: row.quantity > availableQuantity,
  };
}

/** Reads the cart, pricing every line from the database. */
export async function getCartView(owner: CartOwner): Promise<CartView> {
  const cart = await findActiveCart(owner);
  if (!cart) return EMPTY_CART;

  const rows = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
    include: LINE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

  const lines = rows.map(toLine).filter((line): line is CartLine => line !== null);

  return {
    cartId: cart.id,
    lines,
    subtotalPaise: lines.reduce((sum, line) => sum + line.lineTotalPaise, 0),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    currency: CURRENCY,
    hasUnavailableLines: lines.some((line) => line.exceedsStock || !line.inStock),
  };
}

export type CartMutationResult =
  | { ok: true; cartId: string }
  | { ok: false; reason: "product_unavailable" | "variant_invalid" | "invalid_quantity" | "insufficient_stock" | "not_found"; message: string };

const MESSAGES = {
  product_unavailable: "This item is no longer available.",
  variant_invalid: "That option is not available for this item.",
  invalid_quantity: `Choose a quantity between 1 and ${MAX_LINE_QUANTITY}.`,
  insufficient_stock: "There is not enough stock for that quantity.",
  not_found: "That cart item could not be found.",
} as const;

function fail(reason: keyof typeof MESSAGES): CartMutationResult {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/**
 * Validates a product/variant pair and returns its current availability.
 *
 * This is the single gate every mutation passes through: it rejects inactive
 * products, non-physical products, and a variant that belongs to a different
 * product, so an arbitrary id pair can never enter a cart.
 */
async function validateSelection(productId: string, productVariantId: string | null) {
  const product = await prisma.product.findFirst({
    where: { id: productId, active: true, type: ProductType.PHYSICAL },
    select: {
      id: true,
      inventory: { select: { quantity: true, status: true } },
      variants: { select: { id: true, inventory: { select: { quantity: true, status: true } } } },
    },
  });

  if (!product) return { ok: false as const, reason: "product_unavailable" as const };

  if (productVariantId) {
    const variant = product.variants.find((candidate) => candidate.id === productVariantId);
    if (!variant) return { ok: false as const, reason: "variant_invalid" as const };

    const available =
      variant.inventory?.status === InventoryStatus.IN_STOCK ? Math.max(0, variant.inventory.quantity) : 0;
    return { ok: true as const, available };
  }

  const available =
    product.inventory?.status === InventoryStatus.IN_STOCK ? Math.max(0, product.inventory.quantity) : 0;
  return { ok: true as const, available };
}

export async function addToCart(
  owner: CartOwner,
  input: { productId: string; productVariantId?: string | null; quantity: number },
): Promise<CartMutationResult> {
  const quantity = Math.trunc(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) return fail("invalid_quantity");

  const variantId = input.productVariantId ?? null;
  const selection = await validateSelection(input.productId, variantId);
  if (!selection.ok) return fail(selection.reason);
  if (selection.available < quantity) return fail("insufficient_stock");

  const cart = await resolveCart(owner);

  // A Postgres UNIQUE containing NULL does not prevent duplicates, so the
  // existing line is located by an explicit match rather than the compound key.
  const existing = await prisma.cartItem.findFirst({
    where: { cartId: cart.id, productId: input.productId, productVariantId: variantId },
    select: { id: true, quantity: true },
  });

  // Same product and same variant combine; a different variant stays separate.
  const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, MAX_LINE_QUANTITY);
  if (nextQuantity > selection.available) return fail("insufficient_stock");

  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: input.productId, productVariantId: variantId, quantity: nextQuantity },
    });
  }

  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
  return { ok: true, cartId: cart.id };
}

export async function updateCartItemQuantity(
  owner: CartOwner,
  input: { itemId: string; quantity: number },
): Promise<CartMutationResult> {
  const quantity = Math.trunc(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) return fail("invalid_quantity");

  const cart = await findActiveCart(owner);
  if (!cart) return fail("not_found");

  // Scoped by cartId so one caller cannot touch another caller's line.
  const item = await prisma.cartItem.findFirst({
    where: { id: input.itemId, cartId: cart.id },
    select: { id: true, productId: true, productVariantId: true },
  });
  if (!item) return fail("not_found");

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return { ok: true, cartId: cart.id };
  }

  const selection = await validateSelection(item.productId, item.productVariantId);
  if (!selection.ok) return fail(selection.reason);
  if (selection.available < quantity) return fail("insufficient_stock");

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return { ok: true, cartId: cart.id };
}

export async function removeCartItem(owner: CartOwner, itemId: string): Promise<CartMutationResult> {
  const cart = await findActiveCart(owner);
  if (!cart) return fail("not_found");

  const deleted = await prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
  if (deleted.count === 0) return fail("not_found");

  return { ok: true, cartId: cart.id };
}

/**
 * Merges an anonymous cart into the signed-in user's cart.
 *
 * Same product and same variant combine their quantities; a different variant
 * stays a separate line. Every merged quantity is clamped to the line maximum
 * and to stock actually available, so a merge can never create an unfulfillable
 * cart. The anonymous cart is marked CONVERTED rather than deleted, keeping the
 * operation traceable and safe to repeat.
 */
export async function mergeAnonymousCart(userId: string, token: string): Promise<{ merged: number }> {
  const anonymous = await prisma.cart.findFirst({
    where: { sessionId: hashCartToken(token), status: CartStatus.ACTIVE },
    select: { id: true, items: { select: { productId: true, productVariantId: true, quantity: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!anonymous || anonymous.items.length === 0) {
    if (anonymous) {
      await prisma.cart.update({ where: { id: anonymous.id }, data: { status: CartStatus.CONVERTED } });
    }
    return { merged: 0 };
  }

  const target = await resolveCart({ userId });
  let merged = 0;

  for (const item of anonymous.items) {
    const selection = await validateSelection(item.productId, item.productVariantId);
    if (!selection.ok || selection.available < 1) continue;

    const existing = await prisma.cartItem.findFirst({
      where: { cartId: target.id, productId: item.productId, productVariantId: item.productVariantId },
      select: { id: true, quantity: true },
    });

    const desired = (existing?.quantity ?? 0) + item.quantity;
    const clamped = Math.min(desired, MAX_LINE_QUANTITY, selection.available);
    if (clamped < 1) continue;

    if (existing) {
      await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: clamped } });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: target.id,
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantity: clamped,
        },
      });
    }
    merged += 1;
  }

  await prisma.cart.update({ where: { id: anonymous.id }, data: { status: CartStatus.CONVERTED } });
  return { merged };
}

/** Marks a cart converted. Called only after a payment is confirmed. */
export async function markCartConverted(cartId: string): Promise<void> {
  await prisma.cart.updateMany({
    where: { id: cartId, status: CartStatus.ACTIVE },
    data: { status: CartStatus.CONVERTED },
  });
}
