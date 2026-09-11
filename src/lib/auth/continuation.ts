import "server-only";

import { cookies } from "next/headers";
import {
  CONTINUATION_MAX_AGE_SECONDS,
  createContinuationToken,
  readContinuationToken,
} from "@/lib/auth/continuation-token";

/**
 * Save-after-login continuation transport.
 *
 * When an anonymous visitor asks to save a Kundli we mint a short-lived, signed,
 * HttpOnly cookie naming only the calculation id. The id is an opaque UUID, so
 * no birth data - name, date, time or place - ever travels through a URL, a
 * query string or client-readable storage.
 *
 * On return from the identity provider the claim is only honoured when this
 * cookie is present, unexpired, correctly signed, and names the exact
 * calculation being claimed. Knowing a result URL is therefore never on its own
 * sufficient to attach that result to an account.
 */
const COOKIE_NAME = "Tarun_kundli_continuation";

export async function setContinuationCookie(calculationId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createContinuationToken(calculationId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONTINUATION_MAX_AGE_SECONDS,
  });
}

/** Reads the continuation cookie and confirms it authorises this calculation. */
export async function consumeContinuation(calculationId: string): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  const claimed = readContinuationToken(token);
  return claimed !== null && claimed === calculationId;
}

export async function clearContinuationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const CONTINUATION_COOKIE_NAME = COOKIE_NAME;
