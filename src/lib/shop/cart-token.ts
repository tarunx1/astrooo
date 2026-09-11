import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Anonymous cart identity.
 *
 * The browser holds a 256-bit opaque token in an HttpOnly cookie. Only its
 * SHA-256 digest is stored on the Cart row, so a database leak does not hand
 * anyone a working cart cookie. No price, product or quantity is ever kept
 * browser-side: the token identifies a cart and nothing more.
 *
 * Kept free of `server-only` and `next/headers` so the hashing rules can be
 * tested directly.
 */
export const CART_COOKIE_NAME = "Tarun_cart";
export const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function createCartToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Rejects malformed tokens before they ever reach a query. */
export function isValidCartToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function cartTokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
