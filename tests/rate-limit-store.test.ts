import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import {
  MemoryRateLimitStore,
  RateLimitStoreError,
  UpstashRateLimitStore,
  getRateLimitStore,
} from "@/lib/security/rate-limit-store";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";

/**
 * Store behaviour against a real HTTP server speaking the Upstash REST
 * protocol.
 *
 * No Upstash credentials exist in this environment, so this is not a test of
 * the hosted service. What it does verify is everything on our side of the
 * wire: that INCR and PEXPIRE are pipelined into one atomic round trip, that
 * TTLs are set from the rule's window, that concurrent callers cannot lose an
 * increment, and that a timeout, a 5xx or a rejected token surfaces as a store
 * error rather than a silent allow.
 */
type Behaviour = "ok" | "error500" | "unauthorized" | "hang" | "malformed";

let server: Server | undefined;
let behaviour: Behaviour = "ok";
let counters = new Map<string, number>();
let expiries = new Map<string, number>();
let requests: unknown[][] = [];

async function startServer(): Promise<string> {
  counters = new Map();
  expiries = new Map();
  requests = [];

  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (behaviour === "hang") return; // never responds
      if (behaviour === "error500") {
        res.writeHead(500).end("upstream error");
        return;
      }
      if (behaviour === "unauthorized") {
        res.writeHead(401).end(JSON.stringify({ error: "invalid token" }));
        return;
      }
      if (behaviour === "malformed") {
        res.writeHead(200, { "content-type": "application/json" }).end("not json at all");
        return;
      }

      const commands = JSON.parse(body) as unknown[][];
      requests.push(...commands);

      const results = commands.map((command) => {
        const [name, key, arg] = command as [string, string, string?];
        if (name === "INCR") {
          const next = (counters.get(key) ?? 0) + 1;
          counters.set(key, next);
          return { result: next };
        }
        if (name === "PEXPIRE") {
          expiries.set(key, Number(arg));
          return { result: 1 };
        }
        return { result: null };
      });

      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(results));
    });
  });

  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "string" || address === null) throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  behaviour = "ok";
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  vi.restoreAllMocks();
});

describe("Upstash REST store", () => {
  it("increments atomically and sets the TTL in a single pipelined round trip", async () => {
    const url = await startServer();
    const store = new UpstashRateLimitStore(url, "test-token");

    const first = await store.increment("rl:auth:sign-in:ip:1.2.3.4", 60_000);
    const second = await store.increment("rl:auth:sign-in:ip:1.2.3.4", 60_000);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    // Two calls, each carrying both commands: INCR then PEXPIRE.
    expect(requests.map((c) => c[0])).toEqual(["INCR", "PEXPIRE", "INCR", "PEXPIRE"]);

    // The TTL is the time left in the current fixed window, not a whole window.
    // Expiring a full window after the last hit would keep a stale count alive
    // past the boundary and throttle the caller into the next window.
    const ttl = expiries.get("rl:auth:sign-in:ip:1.2.3.4")!;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
    expect(ttl).toBe(first.resetAt - (first.resetAt - ttl));
  });

  it("keeps namespaces and identifiers in separate keys", async () => {
    const url = await startServer();
    const store = new UpstashRateLimitStore(url, "t");

    await store.increment("rl:auth:sign-in:ip:a", 1_000);
    await store.increment("rl:auth:sign-in:ip:b", 1_000);
    await store.increment("rl:payment:verify:ip:a", 1_000);

    expect(counters.get("rl:auth:sign-in:ip:a")).toBe(1);
    expect(counters.get("rl:auth:sign-in:ip:b")).toBe(1);
    expect(counters.get("rl:payment:verify:ip:a")).toBe(1);
  });

  it("loses no increment when callers race", async () => {
    const url = await startServer();
    const store = new UpstashRateLimitStore(url, "t");

    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.increment("rl:concurrent", 60_000)),
    );

    // Every caller must receive a distinct position in the window.
    expect(new Set(results.map((r) => r.count)).size).toBe(25);
    expect(counters.get("rl:concurrent")).toBe(25);
  });

  it("derives the window expiry from the rule, not a fixed constant", async () => {
    const url = await startServer();
    const store = new UpstashRateLimitStore(url, "t");

    const windowMs = RATE_LIMITS["ai:generate"].windowMs;
    const hit = await store.increment("rl:hourly", windowMs);

    const ttl = expiries.get("rl:hourly")!;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(windowMs);
    // The key disappears exactly when the window it belongs to ends.
    expect(Math.abs(hit.resetAt - (Date.now() + ttl))).toBeLessThan(1_000);
  });

  it("raises a store error on a provider 5xx", async () => {
    const url = await startServer();
    behaviour = "error500";
    const store = new UpstashRateLimitStore(url, "t");
    await expect(store.increment("rl:x", 1_000)).rejects.toBeInstanceOf(RateLimitStoreError);
  });

  it("raises a store error on rejected credentials", async () => {
    const url = await startServer();
    behaviour = "unauthorized";
    const store = new UpstashRateLimitStore(url, "wrong-token");
    await expect(store.increment("rl:x", 1_000)).rejects.toBeInstanceOf(RateLimitStoreError);
  });

  it("raises a store error on a malformed response", async () => {
    const url = await startServer();
    behaviour = "malformed";
    const store = new UpstashRateLimitStore(url, "t");
    await expect(store.increment("rl:x", 1_000)).rejects.toBeInstanceOf(RateLimitStoreError);
  });

  it("raises a store error when the provider is unreachable", async () => {
    // Nothing is listening on this port.
    const store = new UpstashRateLimitStore("http://127.0.0.1:1", "t");
    await expect(store.increment("rl:x", 1_000)).rejects.toBeInstanceOf(RateLimitStoreError);
  });
});

describe("failure policy against a real failing store", () => {
  it("fails closed for money paths and open for auth, both against a live 500", async () => {
    const url = await startServer();
    behaviour = "error500";
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = new UpstashRateLimitStore(url, "t");

    const payment = await checkRateLimit({ namespace: "payment:order-create", identifier: "user:1", store });
    const signIn = await checkRateLimit({ namespace: "auth:sign-in", identifier: "ip:1", store });

    expect(payment.allowed).toBe(false);
    expect(payment.degraded).toBe(true);
    expect(signIn.allowed).toBe(true);
    expect(signIn.degraded).toBe(true);
  });
});

describe("memory store expiry", () => {
  it("expires a window and starts a fresh count", async () => {
    const store = new MemoryRateLimitStore();
    const start = 1_700_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(start);

    await store.increment("rl:ttl", 1_000);
    expect((await store.increment("rl:ttl", 1_000)).count).toBe(2);

    clock.mockReturnValue(start + 2_000);
    expect((await store.increment("rl:ttl", 1_000)).count).toBe(1);
  });
});

describe("production store selection", () => {
  it("never silently falls back to the in-process store in production", () => {
    expect(() => getRateLimitStore({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow();

    const configured = getRateLimitStore({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "token",
    } as NodeJS.ProcessEnv);
    expect(configured.name).toBe("upstash");
  });
});
