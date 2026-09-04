import "server-only";

/**
 * Rate-limit backing store.
 *
 * The counter must be shared across instances: this application can run on
 * several serverless workers, so a process-local Map would give each worker its
 * own quota and multiply the real limit by the worker count. That is why the
 * production adapter talks to Upstash Redis.
 *
 * The Upstash adapter uses the REST API over plain `fetch` rather than a client
 * SDK, so distributed rate limiting adds no new dependency and works unchanged
 * in serverless and edge runtimes.
 */
export type RateLimitHit = {
  /** Requests recorded in the current window, including this one. */
  count: number;
  /** Unix ms at which the current window ends. */
  resetAt: number;
};

export interface RateLimitStore {
  readonly name: string;
  /**
   * Records one request against `key` and returns the running count.
   *
   * Must be atomic: two concurrent calls have to return different counts, or
   * the limit can be exceeded under load.
   */
  increment(key: string, windowMs: number): Promise<RateLimitHit>;
}

/** Raised when the store itself is unreachable, so callers can apply policy. */
export class RateLimitStoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RateLimitStoreError";
  }
}

/** Fixed windows are aligned to the clock so every instance agrees on boundaries. */
export function windowStartFor(now: number, windowMs: number): number {
  return Math.floor(now / windowMs) * windowMs;
}

/**
 * In-memory store.
 *
 * For local development and tests only. It is explicitly not valid in
 * production because each instance would hold its own counters; `getRateLimitStore`
 * refuses to select it when a production deployment has no Redis configured.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly name = "memory";

  private readonly counters = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const existing = this.counters.get(key);

    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: windowStartFor(now, windowMs) + windowMs };
      this.counters.set(key, entry);
      this.sweep(now);
      return { ...entry };
    }

    existing.count += 1;
    return { ...existing };
  }

  /** Keeps the map from growing without bound in a long-lived dev server. */
  private sweep(now: number) {
    if (this.counters.size < 5_000) return;
    for (const [key, entry] of this.counters) {
      if (entry.resetAt <= now) this.counters.delete(key);
    }
  }

  reset() {
    this.counters.clear();
  }
}

/**
 * Upstash Redis store over the REST API.
 *
 * `INCR` and `PEXPIRE` are issued as one pipelined request: `INCR` is atomic, so
 * concurrent workers always receive distinct counts, and the expiry is set on
 * every hit so a key can never be left without a TTL.
 */
export class UpstashRateLimitStore implements RateLimitStore {
  readonly name = "upstash";

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly timeoutMs = 1_500,
  ) {}

  async increment(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = Date.now();
    const resetAt = windowStartFor(now, windowMs) + windowMs;
    const ttlMs = Math.max(1, resetAt - now);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.url.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, String(ttlMs)],
        ]),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      // The message deliberately names no key and carries no credentials.
      throw new RateLimitStoreError("Rate limit store is unreachable.", error);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new RateLimitStoreError(`Rate limit store returned HTTP ${response.status}.`);
    }

    const payload = (await response.json().catch(() => null)) as Array<{ result?: unknown }> | null;
    const count = Number(payload?.[0]?.result);

    if (!Number.isFinite(count)) {
      throw new RateLimitStoreError("Rate limit store returned an unexpected response.");
    }

    return { count, resetAt };
  }
}

let cachedStore: RateLimitStore | null = null;

/** Test seam: lets the suite install a store without touching the environment. */
export function setRateLimitStore(store: RateLimitStore | null): void {
  cachedStore = store;
}

export function getRateLimitStore(env: NodeJS.ProcessEnv = process.env): RateLimitStore {
  if (cachedStore) return cachedStore;

  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    cachedStore = new UpstashRateLimitStore(url, token);
    return cachedStore;
  }

  if (env.NODE_ENV === "production") {
    // Falling back to a per-instance Map in production would quietly multiply
    // every limit by the number of running instances, which is worse than an
    // obvious failure at boot.
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production for distributed rate limiting.",
    );
  }

  cachedStore = new MemoryRateLimitStore();
  return cachedStore;
}
