/**
 * Safe return-URL handling.
 *
 * Only same-origin, path-absolute destinations are ever honoured. Anything that
 * could leave the application - absolute URLs, protocol-relative URLs, scheme
 * payloads, backslash variants, encoded separators or control characters - is
 * rejected in favour of a safe default.
 */
export const DEFAULT_RETURN_TO = "/account";

/** Control characters and whitespace browsers may strip before navigating. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F\s]/;

/** Any "scheme:" prefix, e.g. javascript:, data:, http:. */
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;

export function isSafeReturnTo(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 512) return false;

  // Browsers strip these before resolving, so "/\thttps://evil.com" must not pass.
  if (CONTROL_CHARACTERS.test(value)) return false;

  // Backslashes are treated as forward slashes by several browsers.
  if (value.includes("\\")) return false;

  if (SCHEME_PREFIX.test(value)) return false;

  // Must be path-absolute, and must not be protocol-relative ("//host").
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;

  // Reject encoded separators that could re-introduce "//" or a host segment.
  const lowered = value.toLowerCase();
  if (lowered.includes("%2f%2f") || lowered.includes("%5c") || lowered.includes("%00")) {
    return false;
  }

  // Final structural check against a fixed base: the origin must not change.
  try {
    const base = "https://tarun-astro.internal";
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return false;
  } catch {
    return false;
  }

  return true;
}

/** Returns `value` when it is a safe internal destination, otherwise the default. */
export function sanitizeReturnTo(value: unknown, fallback: string = DEFAULT_RETURN_TO): string {
  return isSafeReturnTo(value) ? value : fallback;
}

export function buildSignInHref(returnTo?: unknown): string {
  const safe = isSafeReturnTo(returnTo) ? returnTo : null;
  return safe ? `/sign-in?returnTo=${encodeURIComponent(safe)}` : "/sign-in";
}
