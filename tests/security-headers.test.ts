import { describe, expect, it } from "vitest";
import {
  IMAGE_ORIGINS,
  RAZORPAY_API_ORIGINS,
  RAZORPAY_SCRIPT_ORIGIN,
  buildContentSecurityPolicy,
  staticSecurityHeaders,
} from "@/lib/security/headers";

/**
 * The policy is asserted here rather than only observed in a browser, so a
 * later edit that quietly widens it fails a test instead of shipping.
 */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values] as const;
    }),
  );
}

const prod = () => directives(buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: false }));
const dev = () => directives(buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: true }));

describe("content security policy", () => {
  it("binds scripts to the per-request nonce with strict-dynamic", () => {
    const scriptSrc = prod().get("script-src")!;
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("never allows unsafe-eval or unsafe-inline scripts in production", () => {
    const scriptSrc = prod().get("script-src")!.join(" ");
    expect(scriptSrc).not.toContain("unsafe-eval");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("allows eval and websockets in development only, for React and hot reload", () => {
    expect(dev().get("script-src")!).toContain("'unsafe-eval'");
    expect(dev().get("connect-src")!).toContain("ws:");
    expect(prod().get("connect-src")!).not.toContain("ws:");
  });

  it("refuses framing through frame-ancestors", () => {
    expect(prod().get("frame-ancestors")).toEqual(["'none'"]);
  });

  it("locks down the directives that enable injection", () => {
    const policy = prod();
    expect(policy.get("object-src")).toEqual(["'none'"]);
    expect(policy.get("base-uri")).toEqual(["'self'"]);
    expect(policy.get("form-action")).toEqual(["'self'"]);
    expect(policy.get("default-src")).toEqual(["'self'"]);
  });

  it("permits the payment widget to load and open its iframe", () => {
    const policy = prod();
    expect(policy.get("frame-src")!).toContain(RAZORPAY_SCRIPT_ORIGIN);
    for (const origin of RAZORPAY_API_ORIGINS) {
      expect(policy.get("connect-src")!).toContain(origin);
    }
  });

  it("allows exactly the image hosts the app actually uses", () => {
    const imgSrc = prod().get("img-src")!;
    for (const origin of IMAGE_ORIGINS) expect(imgSrc).toContain(origin);
    expect(imgSrc).toContain("'self'");
  });

  it("keeps server-only providers out of the browser policy", () => {
    // VedAstro and Gemini are called from server code. Listing them would widen
    // the policy for requests the browser never makes.
    const policy = buildContentSecurityPolicy({ nonce: "n", isDevelopment: false });
    expect(policy).not.toContain("vedastro");
    expect(policy).not.toContain("googleapis");
  });

  it("upgrades insecure requests only where there is TLS to upgrade to", () => {
    expect(buildContentSecurityPolicy({ nonce: "n", isDevelopment: false })).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy({ nonce: "n", isDevelopment: true })).not.toContain("upgrade-insecure-requests");
  });

  it("issues a distinct policy per nonce", () => {
    const a = buildContentSecurityPolicy({ nonce: "one", isDevelopment: false });
    const b = buildContentSecurityPolicy({ nonce: "two", isDevelopment: false });
    expect(a).not.toBe(b);
  });
});

describe("static security headers", () => {
  const byKey = (isProduction: boolean) =>
    new Map(staticSecurityHeaders({ isProduction }).map((header) => [header.key, header.value]));

  it("sets the headers a production deployment is expected to carry", () => {
    const headers = byKey(true);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sends HSTS in production only", () => {
    expect(byKey(true).get("Strict-Transport-Security")).toContain("max-age=63072000");
    // Over plain http it is meaningless, and it would pin a developer's localhost.
    expect(byKey(false).has("Strict-Transport-Security")).toBe(false);
  });

  it("denies powerful features the site never uses", () => {
    const permissions = byKey(true).get("Permissions-Policy")!;
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });
});
