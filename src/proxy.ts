import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/headers";
import { REQUEST_ID_HEADER, normalizeRequestId } from "@/lib/observability/request-context";

/**
 * Per-request CSP nonce and correlation id.
 *
 * Next 16 renamed Middleware to Proxy; the behaviour is the same. A fresh nonce
 * is generated for every request and passed to the render through a request
 * header, so `script-src` can stay strict without allowlisting inline scripts.
 *
 * The matcher deliberately skips static assets, image optimisation and the API
 * surface: those responses carry no HTML and therefore no inline script to
 * authorise, and running this on them would add latency for nothing. Their
 * non-CSP security headers still come from `next.config.ts`, which applies to
 * every route.
 */
export const NONCE_HEADER = "x-nonce";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";

  const csp = buildContentSecurityPolicy({ nonce, isDevelopment });

  // An inbound id is kept only when it matches the expected shape, so a caller
  // cannot inject newlines or unbounded text into log files through it.
  const requestId = normalizeRequestId(request.headers.get(REQUEST_ID_HEADER));

  // The nonce and correlation id reach the render through the request; the
  // policy goes back to the browser on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  // Echoed so an operator can tie a report of a broken page to its log lines.
  // The id is random and carries no user, session or account information.
  response.headers.set(REQUEST_ID_HEADER, requestId);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
