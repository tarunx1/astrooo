/**
 * Trusted client address resolution.
 *
 * ## Why this is not just `x-forwarded-for[0]`
 *
 * `X-Forwarded-For` is a list that each proxy appends to. Entries on the left
 * are whatever the *client* sent; only entries appended by infrastructure you
 * control are trustworthy. Reading the leftmost entry therefore hands an
 * attacker a free knob: sending a different value per request produces an
 * endless supply of fresh rate-limit buckets, which silently defeats every
 * IP-keyed limit.
 *
 * So the resolver works from the right. With one trusted proxy in front of the
 * app, the last entry is the address that proxy actually observed. Deployments
 * with more hops declare that with `TRUSTED_PROXY_HOPS`.
 *
 * ## Hosting assumptions
 *
 * `TRUSTED_PROXY_PLATFORM` names the deployment so the resolver can prefer a
 * header the platform sets itself and overwrites on every request. Those cannot
 * be forged by a client, because the edge replaces whatever arrived:
 *
 * - `vercel`     — `x-vercel-forwarded-for`
 * - `cloudflare` — `cf-connecting-ip`
 * - `fly`        — `fly-client-ip`
 * - `generic`    — no platform header; use `x-forwarded-for` with the hop count
 * - unset/`none` — direct exposure; no forwarding header is trusted at all
 *
 * Choosing wrongly is a security decision, so the default is the conservative
 * one: with nothing configured, no proxy header is trusted.
 */
export type TrustedPlatform = "vercel" | "cloudflare" | "fly" | "generic" | "none";

const PLATFORM_HEADER: Record<Exclude<TrustedPlatform, "generic" | "none">, string> = {
  vercel: "x-vercel-forwarded-for",
  cloudflare: "cf-connecting-ip",
  fly: "fly-client-ip",
};

export function configuredPlatform(env: NodeJS.ProcessEnv = process.env): TrustedPlatform {
  const value = (env.TRUSTED_PROXY_PLATFORM ?? "none").toLowerCase();
  if (value === "vercel" || value === "cloudflare" || value === "fly" || value === "generic") return value;
  return "none";
}

function trustedHops(env: NodeJS.ProcessEnv): number {
  const parsed = Number.parseInt(env.TRUSTED_PROXY_HOPS ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10);
}

/** Strips a port and IPv6 brackets, and rejects anything that is not an address. */
export function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value === "") return null;

  // "[::1]:443" -> "::1"
  if (value.startsWith("[")) {
    const close = value.indexOf("]");
    if (close > 0) value = value.slice(1, close);
  }

  // IPv6-mapped IPv4 addresses log better in their familiar form. This has to
  // happen before port stripping: "::ffff:203.0.113.5" contains both a dot and
  // colons, so it would otherwise be mistaken for an address with a port.
  if (value.toLowerCase().startsWith("::ffff:")) value = value.slice(7);

  // A host:port pair is only unambiguous for IPv4, which has exactly one colon.
  // A bare IPv6 address has several and must be left alone.
  if (value.includes(".") && value.split(":").length === 2) {
    value = value.slice(0, value.indexOf(":"));
  }

  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
  const isIpv6 = /^[0-9a-fA-F:]+$/.test(value) && value.includes(":");
  if (!isIpv4 && !isIpv6) return null;

  if (isIpv4 && value.split(".").some((part) => Number(part) > 255)) return null;

  return value;
}

/**
 * Resolves the client address, or null when none can be trusted.
 *
 * Returning null is a real answer, not a failure: callers key on a shared
 * bucket instead, which is the safe direction. Inventing a unique identifier
 * from an untrusted header would be worse than having none.
 */
export function resolveClientIp(
  headerList: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const platform = configuredPlatform(env);
  if (platform === "none") return null;

  if (platform !== "generic") {
    const header = PLATFORM_HEADER[platform];
    // The platform overwrites this header, so the leftmost entry is safe here.
    const value = headerList.get(header);
    const first = value?.split(",")[0];
    return normalizeAddress(first);
  }

  const forwarded = headerList.get("x-forwarded-for");
  if (!forwarded) return normalizeAddress(headerList.get("x-real-ip"));

  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

  if (entries.length === 0) return null;

  // Count in from the right: those entries were appended by our own proxies.
  // Anything further left came from the client and is not evidence of anything.
  const index = entries.length - trustedHops(env);
  const candidate = entries[Math.max(0, index)];

  return normalizeAddress(candidate);
}

/**
 * A rate-limit identifier for an unauthenticated caller.
 *
 * When no address can be trusted, every anonymous caller shares one bucket.
 * That is intentionally strict: it throttles a real attack, and the alternative
 * -- trusting a spoofable header -- provides no limit at all.
 */
export function anonymousRateLimitIdentifier(
  headerList: Headers,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const address = resolveClientIp(headerList, env);
  return address ? `ip:${address}` : "ip:untrusted";
}
