import "server-only";

import { cookies } from "next/headers";
import {
  CART_COOKIE_MAX_AGE_SECONDS,
  CART_COOKIE_NAME,
  createCartToken,
  isValidCartToken,
} from "@/lib/shop/cart-token";
import { getCurrentUser } from "@/lib/auth/session";
import { mergeAnonymousCart, type CartOwner } from "@/lib/shop/cart";

/**
 * Resolves who owns the current cart.
 *
 * A signed-in user always owns their cart by userId. An anonymous visitor is
 * identified by an opaque HttpOnly cookie whose digest is what the database
 * stores. Nothing about the cart's contents or prices lives browser-side.
 */
export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CART_COOKIE_NAME)?.value;
  return isValidCartToken(value) ? value : null;
}

/** Reads the token, minting one if this visitor does not have a valid cart cookie. */
export async function ensureCartToken(): Promise<string> {
  const existing = await readCartToken();
  if (existing) return existing;

  const token = createCartToken();
  const store = await cookies();
  store.set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  });

  return token;
}

/** Owner for reads. Returns null when there is neither a session nor a cookie. */
export async function resolveCartOwnerForRead(): Promise<CartOwner | null> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };

  const token = await readCartToken();
  return token ? { token } : null;
}

/** Owner for writes. Mints an anonymous token when needed. */
export async function resolveCartOwnerForWrite(): Promise<CartOwner> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };

  return { token: await ensureCartToken() };
}

/**
 * Merges a leftover anonymous cart into the signed-in user's cart.
 *
 * Called on cart and checkout entry, which is exactly when a visitor arrives
 * back from sign-in. The anonymous cart is marked CONVERTED by the merge, so a
 * stale cookie resolves to nothing on subsequent visits and this is safe to call
 * on every request. No cookie is written, so it is safe during render.
 */
export async function syncAnonymousCartIntoAccount(): Promise<{ merged: number }> {
  const user = await getCurrentUser();
  if (!user) return { merged: 0 };

  const token = await readCartToken();
  if (!token) return { merged: 0 };

  return mergeAnonymousCart(user.id, token);
}
