import "server-only";

import { headers } from "next/headers";
import { NONCE_HEADER } from "@/proxy";

/**
 * Reads the per-request CSP nonce set by the proxy.
 *
 * Returns undefined when the proxy did not run — for example in a unit test or
 * on a route excluded from the matcher. Rendering a script without a nonce in
 * that case is correct: there is no policy in force to satisfy.
 */
export async function getCspNonce(): Promise<string | undefined> {
  const headerList = await headers();
  return headerList.get(NONCE_HEADER) ?? undefined;
}
