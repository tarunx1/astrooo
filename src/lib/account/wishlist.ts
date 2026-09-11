import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/**
 * The wishlist.
 *
 * Stores a product reference and nothing else - the existing `Wishlist` model
 * is already normalized that way, and it is the right shape: copying a title
 * and a price into the row would leave a customer looking at a price that has
 * since changed, which is exactly the bug `OrderItem` snapshots exist to
 * prevent in the other direction.
 *
 * Every read and write is scoped by `userId` inside the query, so one
 * customer's list is not something a page has to remember to filter.
 */

/**
 * The price a customer would actually pay.
 *
 * A sale price is the price; the original becomes the compare-at. Kept local
 * rather than imported from the catalogue module, which is `server-only` and
 * does not export it.
 */
function effectivePrice(
  pricePaise: number,
  salePricePaise: number | null,
): { priceMinor: number; compareAtPriceMinor: number | null } {
  if (salePricePaise !== null && salePricePaise < pricePaise) {
    return { priceMinor: salePricePaise, compareAtPriceMinor: pricePaise };
  }
  return { priceMinor: pricePaise, compareAtPriceMinor: null };
}

export type WishlistEntry = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  currency: string;
  imageUrl: string | null;
  inStock: boolean;
  /** False once a product is delisted; the entry stays but cannot be bought. */
  available: boolean;
  addedAt: Date;
};

const ENTRY_SELECT = {
  id: true,
  productId: true,
  createdAt: true,
  product: {
    select: {
      slug: true,
      title: true,
      pricePaise: true,
      salePricePaise: true,
      currency: true,
      active: true,
      images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
      inventory: { select: { quantity: true } },
    },
  },
} satisfies Prisma.WishlistSelect;

export async function listWishlist(userId: string): Promise<WishlistEntry[]> {
  const rows = await prisma.wishlist.findMany({
    where: { userId },
    select: ENTRY_SELECT,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return rows.map((row) => {
    const price = effectivePrice(row.product.pricePaise, row.product.salePricePaise);

    return {
      id: row.id,
      productId: row.productId,
      slug: row.product.slug,
      title: row.product.title,
      priceMinor: price.priceMinor,
      compareAtPriceMinor: price.compareAtPriceMinor,
      currency: row.product.currency,
      imageUrl: row.product.images[0]?.url ?? null,
      inStock: (row.product.inventory?.quantity ?? 0) > 0,
      available: row.product.active,
      addedAt: row.createdAt,
    };
  });
}

export type WishlistResult =
  | { ok: true; added: boolean; alreadyPresent: boolean }
  | { ok: false; message: string };

/**
 * Adds a product to the caller's wishlist.
 *
 * Idempotent: adding something already saved succeeds rather than erroring,
 * because from the customer's point of view the desired state - "this is on my
 * list" - is what they asked for either way. The unique constraint on
 * `(userId, productId)` is what makes that safe under a double click.
 */
export async function addToWishlist(input: {
  userId: string;
  productId: string;
}): Promise<WishlistResult> {
  // The product must exist and be listed. Saving a delisted product would put
  // something on a customer's list that they can never act on.
  const product = await prisma.product.findFirst({
    where: { id: input.productId, active: true },
    select: { id: true },
  });

  if (!product) return { ok: false, message: "That product is not available." };

  try {
    await prisma.wishlist.create({
      data: { userId: input.userId, productId: product.id },
    });

    return { ok: true, added: true, alreadyPresent: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Already saved. Reaching the unique constraint is the normal outcome of
      // a double submit, not a fault.
      return { ok: true, added: false, alreadyPresent: true };
    }
    throw error;
  }
}

/**
 * Removes an entry.
 *
 * Scoped by `userId` in the `where`, so a crafted request naming another
 * customer's entry deletes nothing and reports "not found".
 */
export async function removeFromWishlist(input: {
  userId: string;
  productId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const deleted = await prisma.wishlist.deleteMany({
    where: { userId: input.userId, productId: input.productId },
  });

  return deleted.count > 0 ? { ok: true } : { ok: false, message: "That item is not on your list." };
}

/** Whether one product is on the caller's list. For the save button's state. */
export async function isWishlisted(input: {
  userId: string;
  productId: string;
}): Promise<boolean> {
  const row = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId: input.userId, productId: input.productId } },
    select: { id: true },
  });

  return row !== null;
}

export async function wishlistCount(userId: string): Promise<number> {
  return prisma.wishlist.count({ where: { userId } });
}
