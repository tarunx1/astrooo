import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";
import { anonymousIdentifier, checkRateLimit, type RateLimitNamespace } from "@/lib/security/rate-limit";

/**
 * Better Auth handler with credential-abuse throttling.
 *
 * Only credential-sensitive POSTs are limited. Session reads and the OAuth
 * callback are deliberately untouched: throttling `get-session` would break
 * ordinary browsing, and throttling the callback would break a legitimate
 * Google round trip.
 *
 * The bucket is keyed on the request address because, by definition, nobody is
 * authenticated yet at this point.
 */
const handlers = toNextJsHandler(auth);

/** Path fragment to namespace. Anything unlisted is not limited here. */
const LIMITED_PATHS: Array<{ match: string; namespace: RateLimitNamespace }> = [
  { match: "/sign-in", namespace: "auth:sign-in" },
  { match: "/sign-up", namespace: "auth:sign-up" },
  { match: "/forget-password", namespace: "auth:credential" },
  { match: "/reset-password", namespace: "auth:credential" },
  { match: "/change-password", namespace: "auth:credential" },
  { match: "/send-verification-email", namespace: "auth:credential" },
  { match: "/verify-email", namespace: "auth:credential" },
  { match: "/two-factor", namespace: "auth:credential" },
  { match: "/email-otp", namespace: "auth:credential" },
  { match: "/phone-number", namespace: "auth:credential" },
];

function namespaceFor(pathname: string): RateLimitNamespace | null {
  return LIMITED_PATHS.find((entry) => pathname.includes(entry.match))?.namespace ?? null;
}

export const GET = handlers.GET;

export async function POST(request: Request): Promise<Response> {
  const namespace = namespaceFor(new URL(request.url).pathname);
  if (!namespace) return handlers.POST(request);

  const decision = await checkRateLimit({ namespace, identifier: await anonymousIdentifier() });

  if (!decision.allowed) {
    // A plain 429 with Retry-After. The body names no key, no address and no
    // limiter internals.
    return Response.json(
      { error: "Too many attempts. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(decision.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return handlers.POST(request);
}
