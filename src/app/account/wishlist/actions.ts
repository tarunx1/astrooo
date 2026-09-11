"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";
import { addToWishlist, removeFromWishlist } from "@/lib/account/wishlist";
import { addToCart } from "@/lib/shop/cart";
import { resolveCartOwnerForWrite } from "@/lib/shop/cart-session";

/**
 * Wishlist actions.
 *
 * Authentication is required - a wishlist belongs to an account, and the
 * anonymous-cart mechanism deliberately does not extend to it. The acting user
 * comes from the session, never from the form, so there is no shape of request
 * that writes to somebody else's list.
 */
const productIdSchema = z.string().trim().min(1).max(64);

export type WishlistActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; needsAuth?: boolean };

export async function toggleWishlistAction(
  productId: string,
  saved: boolean,
): Promise<WishlistActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, message: "Sign in to save items." };

  const decision = await checkRateLimit({ namespace: "cart:mutation", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const parsed = productIdSchema.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "That product is not recognised." };

  if (saved) {
    const result = await removeFromWishlist({ userId: user.id, productId: parsed.data });
    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath("/account/wishlist");
    return { ok: true, message: "Removed from your list." };
  }

  const result = await addToWishlist({ userId: user.id, productId: parsed.data });
  if (!result.ok) return { ok: false, message: result.message };

  revalidatePath("/account/wishlist");
  return { ok: true, message: result.alreadyPresent ? "Already on your list." : "Saved to your list." };
}

/**
 * Moves a saved item into the cart.
 *
 * Reuses the existing cart service rather than writing a second add path, so
 * the same stock and pricing rules apply. The wishlist entry is removed only
 * after the cart write succeeds - losing the saved item because the cart
 * rejected it would be the worst of both outcomes.
 */
export async function moveToCartAction(productId: string): Promise<WishlistActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, needsAuth: true, message: "Sign in first." };

  const decision = await checkRateLimit({ namespace: "cart:mutation", identifier: `user:${user.id}` });
  if (!decision.allowed) return { ok: false, message: rateLimitMessage(decision.retryAfterSeconds) };

  const parsed = productIdSchema.safeParse(productId);
  if (!parsed.success) return { ok: false, message: "That product is not recognised." };

  const owner = await resolveCartOwnerForWrite();
  const added = await addToCart(owner, {
    productId: parsed.data,
    productVariantId: null,
    quantity: 1,
  });

  if (!added.ok) return { ok: false, message: added.message };

  await removeFromWishlist({ userId: user.id, productId: parsed.data });

  revalidatePath("/account/wishlist");
  revalidatePath("/cart");
  return { ok: true, message: "Moved to your cart." };
}
