import { afterEach, describe, expect, it, vi } from "vitest";
import { REDACTED, isSensitiveKey, redact, redactFields } from "@/lib/observability/redact";
import { logger, reportIncident } from "@/lib/observability/logger";
import { generateRequestId, normalizeRequestId } from "@/lib/observability/request-context";

/**
 * Logging is the one place where every other subsystem's data passes through,
 * so the tests here are mostly about what must NOT come out the other side.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("redaction", () => {
  it("recognises credential-shaped keys regardless of casing or separator", () => {
    for (const key of [
      "password", "Password", "userPassword", "secret", "RAZORPAY_KEY_SECRET",
      "apiKey", "api_key", "token", "accessToken", "refreshToken", "otp",
      "cookie", "authorization", "sessionId", "webhookSecret", "privateKey", "signature",
    ]) {
      expect(isSensitiveKey(key), key).toBe(true);
    }
  });

  it("does not redact fields that merely resemble credentials", () => {
    for (const key of ["tokenCount", "signatureValid", "userId", "orderId", "provider", "amountPaise"]) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });

  it("replaces sensitive values at any depth", () => {
    const out = redact({
      userId: "u1",
      auth: { password: "hunter2", nested: { apiKey: "sk-live-abc" } },
      list: [{ token: "t" }],
    }) as Record<string, never>;

    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("sk-live-abc");
    expect(JSON.stringify(out)).toContain(REDACTED);
    // Non-sensitive context survives, or the log would be useless.
    expect(JSON.stringify(out)).toContain("u1");
  });

  it("never mutates the caller's object", () => {
    const original = { password: "hunter2", userId: "u1" };
    redact(original);
    expect(original.password).toBe("hunter2");
  });

  it("redacts credential headers", () => {
    const headers = new Headers({ authorization: "Bearer abc123", "x-request-id": "r1" });
    const out = JSON.stringify(redact(headers));
    expect(out).not.toContain("abc123");
    expect(out).toContain("r1");
  });

  it("bounds runaway values so a provider payload cannot flood the logs", () => {
    const long = redact("x".repeat(5_000)) as string;
    expect(long.length).toBeLessThan(2_100);

    const wide = redact(Array.from({ length: 500 }, (_, i) => i)) as unknown[];
    expect(wide.length).toBeLessThanOrEqual(51);

    let deep: Record<string, unknown> = { value: "bottom" };
    for (let i = 0; i < 20; i += 1) deep = { deep };
    expect(JSON.stringify(redact(deep))).toContain("depth-limit");
  });

  it("redactFields returns a plain object ready to spread into a log line", () => {
    const out = redactFields({ orderId: "o1", razorpayKeySecret: "rzp_secret" });
    expect(out.orderId).toBe("o1");
    expect(out.razorpayKeySecret).toBe(REDACTED);
  });

  it("reduces an Error to name and message, not a stack", () => {
    const out = redact(new Error("boom")) as Record<string, unknown>;
    expect(out).toEqual({ name: "Error", message: "boom" });
  });
});

describe("logger", () => {
  it("redacts fields passed to it", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test_event", { userId: "u1", password: "hunter2" });

    const serialized = JSON.stringify(spy.mock.calls);
    expect(serialized).not.toContain("hunter2");
    expect(serialized).toContain("u1");
  });

  it("emits one JSON line per event in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    logger.info("payment_captured", { orderId: "o1" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({ level: "info", event: "payment_captured", orderId: "o1" });
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("reports incidents at error level with a stable shape", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    reportIncident("payment_webhook_failure", { orderId: "o1" }, new Error("provider exploded"));

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: "error",
      event: "incident",
      incident: "payment_webhook_failure",
      orderId: "o1",
      errorName: "Error",
      errorMessage: "provider exploded",
    });
  });

  it("keeps a rate-limit-store outage visible, including that protection is off", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    reportIncident("rate_limit_store_outage", { namespace: "auth:sign-in", policy: "open", protectionDisabled: true });

    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.incident).toBe("rate_limit_store_outage");
    expect(parsed.protectionDisabled).toBe(true);
  });
});

describe("request ids", () => {
  it("generates url-safe ids", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[A-Za-z0-9]{32}$/);
    expect(generateRequestId()).not.toBe(id);
  });

  it("keeps a well-formed upstream id so traces join up", () => {
    expect(normalizeRequestId("abc123DEF456-_x")).toBe("abc123DEF456-_x");
  });

  it("replaces anything that could forge or flood a log line", () => {
    for (const hostile of [
      "bad id with spaces",
      "line\ninjection",
      "a".repeat(200),
      "short",
      "<script>",
      "id;rm -rf",
      "",
      null,
      undefined,
    ]) {
      const result = normalizeRequestId(hostile as string | null | undefined);
      expect(result).toMatch(/^[A-Za-z0-9]{32}$/);
    }
  });
});
