/**
 * Security headers and Content Security Policy.
 *
 * Kept as data so the same policy can be asserted by tests rather than only
 * observed in a browser.
 *
 * ## Origin audit
 *
 * Every external origin below was found by auditing the repository, not
 * guessed:
 *
 * - `checkout.razorpay.com` — the checkout widget script, injected at runtime
 *   by `lib/payments/razorpay-checkout.ts`.
 * - `api.razorpay.com`, `lumberjack.razorpay.com` — the widget's own XHR and
 *   telemetry, and the iframe it opens.
 * - `images.unsplash.com`, `plus.unsplash.com` — the image hosts already
 *   declared in `next.config.ts` by the homepage redesign.
 *
 * Deliberately absent: `api.vedastro.org` and
 * `generativelanguage.googleapis.com`. Both are called only from server code,
 * so neither belongs in a browser `connect-src`. Adding them would widen the
 * policy for no reason.
 *
 * Fonts are local system stacks, so `font-src 'self'` is sufficient and no
 * Google Fonts origin is needed.
 */
export const RAZORPAY_SCRIPT_ORIGIN = "https://checkout.razorpay.com";
export const RAZORPAY_API_ORIGINS = ["https://api.razorpay.com", "https://lumberjack.razorpay.com"];
export const IMAGE_ORIGINS = ["https://images.unsplash.com", "https://plus.unsplash.com"];

export type CspOptions = {
  nonce: string;
  isDevelopment: boolean;
};

/**
 * Builds the policy.
 *
 * `script-src` uses a per-request nonce with `strict-dynamic`. That combination
 * is what lets the Razorpay widget work without weakening the policy: our own
 * bundle is nonced, and a script it injects inherits that trust, so no
 * third-party host needs to be blanket-allowed for scripts.
 *
 * Two deliberate relaxations, both documented rather than silent:
 *
 * 1. `style-src` includes `'unsafe-inline'`. React renders `style` attributes
 *    (for example the compatibility score meter) and Tailwind injects styles at
 *    runtime; CSP level 3 governs both through `style-src`. Nonces cannot cover
 *    a `style` attribute, so the alternative would be rewriting working UI. The
 *    residual risk is style injection, which is far less severe than script
 *    execution, and `script-src` remains strict.
 * 2. In development only, `'unsafe-eval'` and websocket connections are
 *    allowed, because React's dev build uses `eval` for error stacks and Next
 *    uses a websocket for hot reload. Neither is present in production.
 */
export function buildContentSecurityPolicy({ nonce, isDevelopment }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Lets already-trusted code load the payment widget without allowlisting hosts.
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ];

  const connectSrc = [
    "'self'",
    ...RAZORPAY_API_ORIGINS,
    ...(isDevelopment ? ["ws:", "wss:"] : []),
  ];

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...IMAGE_ORIGINS]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connectSrc],
    // The Razorpay widget renders its payment sheet in an iframe.
    ["frame-src", ["'self'", RAZORPAY_SCRIPT_ORIGIN, "https://api.razorpay.com"]],
    // Nothing may embed this site: the modern replacement for X-Frame-Options.
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(" ")}`);

  // Only meaningful over HTTPS, and would break a local http dev server.
  if (!isDevelopment) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

/**
 * Headers that do not depend on a per-request nonce.
 *
 * These are applied in `next.config.ts` so they cover every response, including
 * static assets that the proxy does not run for.
 */
export function staticSecurityHeaders(options: { isProduction: boolean }): Array<{ key: string; value: string }> {
  const headers = [
    // Stops a browser from guessing a different content type than we sent.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Sends the full URL same-origin, only the origin cross-origin, nothing over http.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // No page on this site needs a camera, microphone or location.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    // Legacy defence-in-depth alongside frame-ancestors, for older browsers.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (options.isProduction) {
    // HSTS is meaningless over http and would pin a developer's localhost.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
