import "server-only";

import { headers } from "next/headers";

/**
 * Correlation id for one request.
 *
 * The id is minted in the proxy and carried on a request header, the same
 * mechanism the CSP nonce already uses. That keeps one way of passing
 * per-request values through the app rather than two.
 */
export const REQUEST_ID_HEADER = "x-request-id";

/** A client-supplied id is accepted only if it looks like one we would mint. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function generateRequestId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/**
 * Normalises an inbound id.
 *
 * An upstream id is useful for tracing across services, but it is attacker
 * controlled: it reaches log files, so an unchecked value could inject
 * newlines, forge log entries, or carry unbounded data. Anything that does not
 * match the expected shape is replaced rather than sanitised, so a malformed id
 * can never become a partially-trusted one.
 */
export function normalizeRequestId(candidate: string | null | undefined): string {
  if (candidate && SAFE_REQUEST_ID.test(candidate)) return candidate;
  return generateRequestId();
}

/** The current request's id, for logging. */
export async function getRequestId(): Promise<string | undefined> {
  const headerList = await headers();
  return headerList.get(REQUEST_ID_HEADER) ?? undefined;
}
