import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security/headers";

/**
 * Per-request CSP nonce.
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

  // The nonce reaches the render through the request; the policy goes back to
  // the browser on the response.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

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
