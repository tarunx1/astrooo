/**
 * Redaction for structured logs.
 *
 * The rule is deny-by-key rather than deny-by-value: anything whose key looks
 * like a credential is replaced, wherever it sits in the object. Matching on
 * value would be guesswork, and a secret that changed shape would slip through.
 *
 * This runs on every logged object, so it is deliberately shallow-ish and
 * bounded: a runaway provider payload must not become a runaway log line.
 */
const SENSITIVE_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|otp|cookie|authorization|auth[-_]?header|api[-_]?key|keysecret|key[-_]secret|credential|signature|session|bearer|private[-_]?key|salt|webhook[-_]?secret|refresh|access[-_]?key)/i;

/** Keys that are safe despite matching the pattern above. */
const ALLOWED_KEYS = new Set(["tokenCount", "signatureValid", "sessionCount", "hasSession"]);

export const REDACTED = "[redacted]";

const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const MAX_STRING = 2_000;

export function isSensitiveKey(key: string): boolean {
  if (ALLOWED_KEYS.has(key)) return false;
  return SENSITIVE_KEY_PATTERN.test(key);
}

/**
 * Returns a copy of `value` with sensitive fields replaced.
 *
 * Never mutates the input: a caller's object must not be altered just because
 * it was logged.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return `[${typeof value}]`;

  if (depth >= MAX_DEPTH) return "[depth-limit]";

  if (value instanceof Date) return value.toISOString();

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
    if (value.length > MAX_ARRAY) items.push(`[+${value.length - MAX_ARRAY} more]`);
    return items;
  }

  if (typeof value === "object") {
    // Headers and similar iterables are converted so their keys can be filtered.
    const source =
      value instanceof Headers
        ? Object.fromEntries(value.entries())
        : (value as Record<string, unknown>);

    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      out[key] = isSensitiveKey(key) ? REDACTED : redact(item, depth + 1);
    }
    return out;
  }

  return String(value);
}

/** Convenience for the common case of a flat metadata bag. */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  return redact(fields) as Record<string, unknown>;
}
