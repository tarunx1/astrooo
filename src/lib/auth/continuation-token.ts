import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure signing/verification for save-after-login continuations.
 *
 * Kept free of `server-only` and `next/headers` so the security properties can
 * be tested directly. The cookie transport lives in `continuation.ts`.
 */
export const CONTINUATION_MAX_AGE_SECONDS = 60 * 30;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BETTER_AUTH_SECRET must be set to sign continuation tokens.");
    }
    return "development-only-insecure-secret-value";
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createContinuationToken(calculationId: string, now: number = Date.now()): string {
  const expiresAt = now + CONTINUATION_MAX_AGE_SECONDS * 1000;
  const payload = `${calculationId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the calculation id when the token is authentic and unexpired. */
export function readContinuationToken(token: string | undefined, now: number = Date.now()): string | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [calculationId, expiresAtRaw, signature] = parts;
  if (!calculationId || !expiresAtRaw || !signature) return null;

  const payload = `${calculationId}.${expiresAtRaw}`;
  if (!safeEqual(signature, sign(payload))) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return calculationId;
}
