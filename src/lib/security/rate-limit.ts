import "server-only";

import { headers } from "next/headers";
import { getRateLimitStore, RateLimitStoreError, type RateLimitStore } from "@/lib/security/rate-limit-store";
import { getCurrentUser } from "@/lib/auth/session";
import { anonymousRateLimitIdentifier } from "@/lib/security/client-ip";
import { logger, reportIncident } from "@/lib/observability/logger";

/**
 * Central rate limiting.
 *
 * One module, one algorithm, one place where every threshold is written down.
 *
 * ## Store-failure policy
 *
 * When the shared store is unreachable the limiter cannot know the true count,
 * so each namespace declares what should happen. The choice is per-namespace
 * because the trade-off genuinely differs:
 *
 * - `fail: "closed"` for the paths where a single request costs real money —
 *   creating a payment order or calling a paid model. Refusing those during an
 *   outage is cheaper than letting them run unmetered.
 * - `fail: "open"` for authentication and admin work, where failing closed
 *   would lock every customer out of signing in and every operator out of the
 *   business during a Redis outage. Better Auth applies its own limiting as a
 *   second layer, and every fail-open is logged at error level so an outage is
 *   loud rather than silent.
 *
 * Nothing ever fails silently: both branches log.
 */
export type RateLimitNamespace =
  | "auth:sign-in"
  | "auth:sign-up"
  | "auth:credential"
  | "payment:order-create"
  | "payment:verify"
  | "ai:generate"
  | "ai:retry"
  | "admin:mutation"
  | "admin:settings"
  | "admin:secret-replace"
  | "admin:integration-test"
  | "cart:mutation"
  | "astrology:calculate";

type LimitRule = {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** What to do when the shared store is unreachable. */
  fail: "open" | "closed";
  /** Why this threshold, in one line. */
  rationale: string;
};

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * Every limit in the application.
 *
 * Thresholds are deliberately generous enough that ordinary use never sees
 * them: an operator processing a backlog of orders, or a customer retrying a
 * failed card, must not be blocked.
 */
export const RATE_LIMITS: Record<RateLimitNamespace, LimitRule> = {
  "auth:sign-in": {
    limit: 10,
    windowMs: 5 * MINUTE,
    fail: "open",
    rationale: "Throttles credential stuffing while leaving room for genuine mistyped passwords.",
  },
  "auth:sign-up": {
    limit: 5,
    windowMs: 10 * MINUTE,
    fail: "open",
    rationale: "Limits automated account creation; a real person signs up once.",
  },
  "auth:credential": {
    limit: 20,
    windowMs: 10 * MINUTE,
    fail: "open",
    rationale: "Shared bucket for other credential-sensitive auth calls on the same origin.",
  },
  "payment:order-create": {
    limit: 12,
    windowMs: 10 * MINUTE,
    fail: "closed",
    rationale: "Each call creates a real provider order. Generous enough for retries after a failed card.",
  },
  "payment:verify": {
    limit: 30,
    windowMs: 10 * MINUTE,
    fail: "closed",
    rationale: "Callback verification is cheap but signature-guessing must not be unbounded.",
  },
  "ai:generate": {
    limit: 10,
    windowMs: HOUR,
    fail: "closed",
    rationale: "Each generation is a paid model call. Well above what a paying customer needs.",
  },
  "ai:retry": {
    limit: 20,
    windowMs: HOUR,
    fail: "closed",
    rationale: "Operator retries are legitimate but each one costs a model call.",
  },
  "admin:settings": {
    limit: 60,
    windowMs: 5 * MINUTE,
    fail: "open",
    rationale: "Settings are edited in bursts while configuring, but a runaway script should still be caught.",
  },
  "admin:secret-replace": {
    limit: 10,
    windowMs: 10 * MINUTE,
    fail: "closed",
    rationale: "Credential rotation is rare and deliberate. Failing closed is right: better to refuse than to churn provider credentials during an outage.",
  },
  "admin:integration-test": {
    limit: 12,
    windowMs: 10 * MINUTE,
    fail: "closed",
    rationale: "Each test calls a third party. Unmetered use would burn provider quota from the admin UI.",
  },
  "admin:mutation": {
    limit: 120,
    windowMs: 5 * MINUTE,
    fail: "open",
    rationale: "High enough for bulk operational work; catches a runaway script or a compromised session.",
  },
  "cart:mutation": {
    limit: 120,
    windowMs: 5 * MINUTE,
    fail: "open",
    rationale: "Shopping is chatty. This only catches automated hammering.",
  },
  "astrology:calculate": {
    limit: 20,
    windowMs: 10 * MINUTE,
    fail: "closed",
    rationale: "The astrology provider's free tier allows 5 requests a minute; unmetered use would exhaust it for everyone.",
  },
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix ms when the window resets. */
  resetAt: number;
  /** Whole seconds until reset, for a Retry-After header. */
  retryAfterSeconds: number;
  /** True when the decision came from the failure policy, not a real count. */
  degraded: boolean;
};

/**
 * Typed error for Server Actions.
 *
 * Server Actions cannot return an HTTP status, so callers convert this into
 * whatever error shape their form already renders. The message is safe to show
 * a user: it names no key, no identifier and no implementation detail.
 */
export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many attempts. Please try again shortly.");
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/** The user-facing sentence, optionally naming a wait. Never leaks internals. */
export function rateLimitMessage(retryAfterSeconds: number): string {
  if (retryAfterSeconds <= 0) return "Too many attempts. Please try again shortly.";
  if (retryAfterSeconds < 60) return `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`;

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many attempts. Please try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

function logDecision(namespace: RateLimitNamespace, outcome: string, extra: Record<string, unknown> = {}) {
  // Deliberately omits the identifier and the key: an operational log should
  // never become a record of who was rate limited from which address.
  logger.info("rate_limit", { namespace, outcome, ...extra });
}

/**
 * Records one request and decides whether it may proceed.
 *
 * `identifier` must be server-derived. Never pass a value a browser controls.
 */
export async function checkRateLimit(input: {
  namespace: RateLimitNamespace;
  identifier: string;
  store?: RateLimitStore;
  now?: number;
}): Promise<RateLimitDecision> {
  const rule = RATE_LIMITS[input.namespace];
  const now = input.now ?? Date.now();
  const store = input.store ?? getRateLimitStore();

  // The identifier is hashed into the key by the caller's choice of value; the
  // key itself never leaves this module.
  const key = `rl:${input.namespace}:${input.identifier}`;

  try {
    const hit = await store.increment(key, rule.windowMs);
    const allowed = hit.count <= rule.limit;
    const retryAfterSeconds = Math.max(0, Math.ceil((hit.resetAt - now) / 1000));

    if (!allowed) logDecision(input.namespace, "blocked", { limit: rule.limit });

    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - hit.count),
      resetAt: hit.resetAt,
      retryAfterSeconds,
      degraded: false,
    };
  } catch (error) {
    if (!(error instanceof RateLimitStoreError)) throw error;

    // Never silent. This matters most for the fail-open namespaces: while the
    // store is down, brute-force protection on sign-in is not being enforced,
    // and that must be visible to an operator rather than inferred later from a
    // breach. Raised as an incident so it can be alerted on directly.
    reportIncident(
      "rate_limit_store_outage",
      { namespace: input.namespace, policy: rule.fail, protectionDisabled: rule.fail === "open" },
      error,
    );

    const retryAfterSeconds = Math.ceil(rule.windowMs / 1000);

    return {
      allowed: rule.fail === "open",
      limit: rule.limit,
      remaining: 0,
      resetAt: now + rule.windowMs,
      retryAfterSeconds,
      degraded: true,
    };
  }
}

/** Throws the typed error when blocked. For Server Actions. */
export async function enforceRateLimit(input: {
  namespace: RateLimitNamespace;
  identifier: string;
  store?: RateLimitStore;
}): Promise<void> {
  const decision = await checkRateLimit(input);
  if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
}

/**
 * Client address for an unauthenticated surface.
 *
 * Resolution is delegated to the trusted-proxy resolver rather than reading a
 * forwarding header directly. Taking the leftmost `x-forwarded-for` entry, as
 * this previously did, trusts a value the client chooses: an attacker could
 * vary it per request and mint unlimited fresh buckets, which defeats every
 * IP-keyed limit here. An authenticated user id is always preferred.
 */
export async function anonymousIdentifier(): Promise<string> {
  const headerList = await headers();
  return anonymousRateLimitIdentifier(headerList);
}

/**
 * The strongest identity available: the session user id when signed in,
 * otherwise the request address.
 */
export async function actorIdentifier(): Promise<string> {
  const user = await getCurrentUser();
  return user ? `user:${user.id}` : anonymousIdentifier();
}
