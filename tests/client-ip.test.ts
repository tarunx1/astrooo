import { describe, expect, it } from "vitest";
import {
  anonymousRateLimitIdentifier,
  configuredPlatform,
  normalizeAddress,
  resolveClientIp,
} from "@/lib/security/client-ip";

/**
 * Trusted client-address resolution.
 *
 * The property that matters: an attacker who controls request headers must not
 * be able to mint an unlimited supply of distinct rate-limit buckets. Every
 * spoofing test below is written from that angle.
 */
const env = (extra: Record<string, string> = {}) => ({ ...extra }) as NodeJS.ProcessEnv;
const headers = (init: Record<string, string>) => new Headers(init);

describe("platform configuration", () => {
  it("defaults to trusting nothing", () => {
    expect(configuredPlatform(env())).toBe("none");
    expect(configuredPlatform(env({ TRUSTED_PROXY_PLATFORM: "nonsense" }))).toBe("none");
  });

  it("recognises the supported platforms", () => {
    expect(configuredPlatform(env({ TRUSTED_PROXY_PLATFORM: "vercel" }))).toBe("vercel");
    expect(configuredPlatform(env({ TRUSTED_PROXY_PLATFORM: "CloudFlare" }))).toBe("cloudflare");
  });
});

describe("address normalisation", () => {
  it("accepts plain addresses", () => {
    expect(normalizeAddress("203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeAddress("2001:db8::1")).toBe("2001:db8::1");
  });

  it("strips ports and brackets", () => {
    expect(normalizeAddress("203.0.113.5:44321")).toBe("203.0.113.5");
    expect(normalizeAddress("[2001:db8::1]:443")).toBe("2001:db8::1");
  });

  it("unwraps ipv6-mapped ipv4", () => {
    expect(normalizeAddress("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("rejects anything that is not an address", () => {
    for (const bad of ["not-an-ip", "999.1.1.1", "", "  ", null, undefined, "<script>", "1.2.3.4.5"]) {
      expect(normalizeAddress(bad as string), String(bad)).toBeNull();
    }
  });
});

describe("resolution when nothing is trusted", () => {
  it("ignores forwarding headers entirely", () => {
    const h = headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8", "cf-connecting-ip": "9.9.9.9" });
    expect(resolveClientIp(h, env())).toBeNull();
  });

  it("puts every anonymous caller in one shared bucket rather than a spoofable one", () => {
    const a = anonymousRateLimitIdentifier(headers({ "x-forwarded-for": "1.1.1.1" }), env());
    const b = anonymousRateLimitIdentifier(headers({ "x-forwarded-for": "2.2.2.2" }), env());
    expect(a).toBe(b);
    expect(a).toBe("ip:untrusted");
  });
});

describe("generic reverse proxy", () => {
  const generic = env({ TRUSTED_PROXY_PLATFORM: "generic" });

  it("takes the entry appended by our own proxy, not the client's", () => {
    // The client sent the first entry; our proxy appended the real peer last.
    const h = headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.5" });
    expect(resolveClientIp(h, generic)).toBe("203.0.113.5");
  });

  it("cannot be given an unlimited supply of buckets by a spoofed header", () => {
    // An attacker varies the left-hand entries on every request; the resolved
    // address must stay pinned to what our proxy observed.
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const h = headers({ "x-forwarded-for": `10.0.0.${i}, 198.51.100.${i % 3}, 203.0.113.5` });
      seen.add(anonymousRateLimitIdentifier(h, generic));
    }
    expect(seen.size).toBe(1);
    expect([...seen][0]).toBe("ip:203.0.113.5");
  });

  it("counts in further when more proxies are declared", () => {
    const h = headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.5, 10.0.0.1" });
    const twoHops = env({ TRUSTED_PROXY_PLATFORM: "generic", TRUSTED_PROXY_HOPS: "2" });
    expect(resolveClientIp(h, twoHops)).toBe("203.0.113.5");
  });

  it("never reads past the start of the list", () => {
    const h = headers({ "x-forwarded-for": "203.0.113.5" });
    const manyHops = env({ TRUSTED_PROXY_PLATFORM: "generic", TRUSTED_PROXY_HOPS: "9" });
    expect(resolveClientIp(h, manyHops)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip only when no forwarded list exists", () => {
    expect(resolveClientIp(headers({ "x-real-ip": "203.0.113.9" }), generic)).toBe("203.0.113.9");
  });

  it("returns null rather than a garbage bucket when entries are malformed", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "not-an-ip" }), generic)).toBeNull();
  });
});

describe("platform headers", () => {
  it("uses the header the platform overwrites, ignoring a spoofed forwarded list", () => {
    const h = headers({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" });
    expect(resolveClientIp(h, env({ TRUSTED_PROXY_PLATFORM: "cloudflare" }))).toBe("203.0.113.7");
  });

  it("does not fall back to a spoofable header when the platform header is absent", () => {
    // If the platform header is missing, the request did not come through the
    // platform edge. Trusting x-forwarded-for here would reopen the hole.
    const h = headers({ "x-forwarded-for": "1.2.3.4" });
    expect(resolveClientIp(h, env({ TRUSTED_PROXY_PLATFORM: "vercel" }))).toBeNull();
  });

  it("reads the vercel and fly headers", () => {
    expect(resolveClientIp(headers({ "x-vercel-forwarded-for": "203.0.113.1" }), env({ TRUSTED_PROXY_PLATFORM: "vercel" }))).toBe("203.0.113.1");
    expect(resolveClientIp(headers({ "fly-client-ip": "203.0.113.2" }), env({ TRUSTED_PROXY_PLATFORM: "fly" }))).toBe("203.0.113.2");
  });
});
