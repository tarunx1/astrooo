import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRateLimitStore,
  RateLimitStoreError,
  UpstashRateLimitStore,
  getRateLimitStore,
  setRateLimitStore,
  windowStartFor,
  type RateLimitHit,
  type RateLimitStore,
} from "@/lib/security/rate-limit-store";
import {
  RATE_LIMITS,
  RateLimitError,
  checkRateLimit,
  enforceRateLimit,
  isRateLimitError,
  rateLimitMessage,
} from "@/lib/security/rate-limit";

/**
 * Rate limiting.
 *
 * The properties worth proving are the ones an outage or an attacker would
 * exercise: that the window actually resets, that buckets do not bleed into one
 * another, that a store failure resolves per the declared policy rather than
 * silently allowing everything, and that nothing user-facing leaks a key.
 */

/** A store that fails every call, to exercise the failure policy. */
class BrokenStore implements RateLimitStore {
  readonly name = "broken";
  async increment(): Promise<RateLimitHit> {
    throw new RateLimitStoreError("unreachable");
  }
}

afterEach(() => {
  setRateLimitStore(null);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("window arithmetic", () => {
  it("floors a timestamp to the start of its fixed window", () => {
    expect(windowStartFor(10_500, 1_000)).toBe(10_000);
    expect(windowStartFor(10_000, 1_000)).toBe(10_000);
  });
});

describe("checkRateLimit", () => {
  it("allows requests below the limit and counts down remaining", async () => {
    const store = new MemoryRateLimitStore();
    const first = await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:a", store });

    expect(first.allowed).toBe(true);
    expect(first.limit).toBe(RATE_LIMITS["auth:sign-in"].limit);
    expect(first.remaining).toBe(RATE_LIMITS["auth:sign-in"].limit - 1);
    expect(first.degraded).toBe(false);
  });

  it("allows exactly up to the limit, then blocks", async () => {
    const store = new MemoryRateLimitStore();
    const limit = RATE_LIMITS["auth:sign-up"].limit;

    for (let i = 0; i < limit; i += 1) {
      const decision = await checkRateLimit({ namespace: "auth:sign-up", identifier: "ip:b", store });
      expect(decision.allowed).toBe(true);
    }

    const blocked = await checkRateLimit({ namespace: "auth:sign-up", identifier: "ip:b", store });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports a positive retry-after when blocked", async () => {
    const store = new MemoryRateLimitStore();
    const limit = RATE_LIMITS["payment:order-create"].limit;

    for (let i = 0; i <= limit; i += 1) {
      await checkRateLimit({ namespace: "payment:order-create", identifier: "user:x", store });
    }

    const blocked = await checkRateLimit({ namespace: "payment:order-create", identifier: "user:x", store });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMITS["payment:order-create"].windowMs / 1000);
  });

  it("allows again once the window has elapsed", async () => {
    const store = new MemoryRateLimitStore();
    const rule = RATE_LIMITS["ai:generate"];
    const start = 1_000_000_000_000;

    // The store reads the wall clock, so drive that rather than only the `now`
    // argument, otherwise the two disagree about which window a hit lands in.
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);

    for (let i = 0; i <= rule.limit; i += 1) {
      await checkRateLimit({ namespace: "ai:generate", identifier: "user:y", store });
    }

    const blocked = await checkRateLimit({ namespace: "ai:generate", identifier: "user:y", store });
    expect(blocked.allowed).toBe(false);

    clock.mockReturnValue(start + rule.windowMs * 2);
    const afterReset = await checkRateLimit({ namespace: "ai:generate", identifier: "user:y", store });
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(rule.limit - 1);
  });

  it("keeps separate buckets per identifier", async () => {
    const store = new MemoryRateLimitStore();
    const limit = RATE_LIMITS["auth:sign-in"].limit;

    for (let i = 0; i <= limit; i += 1) {
      await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:noisy", store });
    }

    const other = await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:quiet", store });
    expect(other.allowed).toBe(true);
  });

  it("keeps separate buckets per namespace", async () => {
    const store = new MemoryRateLimitStore();
    const limit = RATE_LIMITS["auth:sign-in"].limit;

    for (let i = 0; i <= limit; i += 1) {
      await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:same", store });
    }

    const other = await checkRateLimit({ namespace: "cart:mutation", identifier: "ip:same", store });
    expect(other.allowed).toBe(true);
  });
});

describe("store failure policy", () => {
  it("fails closed for money-spending namespaces", async () => {
    const store = new BrokenStore();
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const namespace of ["payment:order-create", "payment:verify", "ai:generate", "astrology:calculate"] as const) {
      expect(RATE_LIMITS[namespace].fail).toBe("closed");
      const decision = await checkRateLimit({ namespace, identifier: "user:z", store });
      expect(decision.allowed).toBe(false);
      expect(decision.degraded).toBe(true);
    }
  });

  it("fails open for auth and admin, so an outage is not a total lockout", async () => {
    const store = new BrokenStore();
    vi.spyOn(console, "error").mockImplementation(() => {});

    for (const namespace of ["auth:sign-in", "admin:mutation", "cart:mutation"] as const) {
      expect(RATE_LIMITS[namespace].fail).toBe("open");
      const decision = await checkRateLimit({ namespace, identifier: "user:z", store });
      expect(decision.allowed).toBe(true);
      expect(decision.degraded).toBe(true);
    }
  });

  it("never fails silently: a store outage is logged at error level", async () => {
    const store = new BrokenStore();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:secret-value", store });

    expect(spy).toHaveBeenCalledTimes(1);
    // The log must describe the outage without recording who was limited.
    expect(JSON.stringify(spy.mock.calls[0])).not.toContain("secret-value");
  });
});

describe("enforceRateLimit", () => {
  it("throws a typed error once blocked", async () => {
    const store = new MemoryRateLimitStore();
    const limit = RATE_LIMITS["auth:sign-up"].limit;

    for (let i = 0; i < limit; i += 1) {
      await enforceRateLimit({ namespace: "auth:sign-up", identifier: "ip:c", store });
    }

    await expect(enforceRateLimit({ namespace: "auth:sign-up", identifier: "ip:c", store })).rejects.toThrow(
      RateLimitError,
    );

    const error = await enforceRateLimit({ namespace: "auth:sign-up", identifier: "ip:c", store }).catch((e) => e);
    expect(isRateLimitError(error)).toBe(true);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("user-facing message", () => {
  it("never leaks a key, namespace, identifier or store name", () => {
    const messages = [rateLimitMessage(0), rateLimitMessage(30), rateLimitMessage(600), new RateLimitError(30).message];

    for (const message of messages) {
      expect(message).not.toMatch(/rl:|redis|upstash|ip:|user:|admin:|namespace/i);
    }
  });

  it("rounds a wait up to whole minutes when it is a minute or more", () => {
    expect(rateLimitMessage(30)).toContain("30 seconds");
    expect(rateLimitMessage(60)).toContain("1 minute");
    expect(rateLimitMessage(61)).toContain("2 minutes");
  });
});

describe("store selection", () => {
  it("refuses to start in production without a distributed store", () => {
    expect(() =>
      getRateLimitStore({ NODE_ENV: "production" } as NodeJS.ProcessEnv),
    ).toThrow();
  });

  it("uses the in-process store outside production", () => {
    const store = getRateLimitStore({ NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(store.name).toBe("memory");
  });

  it("uses Upstash whenever both credentials are present", () => {
    const store = getRateLimitStore({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    } as NodeJS.ProcessEnv);

    expect(store.name).toBe("upstash");
  });
});

describe("UpstashRateLimitStore", () => {
  it("increments atomically and sets an expiry in one round trip", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ result: 3 }, { result: 1 }]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const store = new UpstashRateLimitStore("https://example.upstash.io", "token");
    const hit = await store.increment("rl:auth:sign-in:ip:a", 60_000);

    expect(hit.count).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/pipeline");
    const body = JSON.parse(String(init.body));
    expect(body[0][0]).toBe("INCR");
    expect(body[1][0]).toBe("PEXPIRE");
  });

  it("raises a store error rather than allowing the request when Upstash fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    const store = new UpstashRateLimitStore("https://example.upstash.io", "token");
    await expect(store.increment("rl:x", 1_000)).rejects.toBeInstanceOf(RateLimitStoreError);
  });
});
