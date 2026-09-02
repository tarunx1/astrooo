import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET ??= "test-secret-value-at-least-16-chars";
});

const { createContinuationToken, readContinuationToken } = await import("@/lib/auth/continuation-token");

const CALCULATION_ID = "2f1c9d4e-6a3b-4c1e-9f7a-1b2c3d4e5f60";

describe("save-after-login continuation token", () => {
  it("round-trips the calculation id it was minted for", () => {
    const token = createContinuationToken(CALCULATION_ID);
    expect(readContinuationToken(token)).toBe(CALCULATION_ID);
  });

  it("carries only the opaque id, never birth data", () => {
    const token = createContinuationToken(CALCULATION_ID);
    expect(token).toContain(CALCULATION_ID);
    expect(token.toLowerCase()).not.toContain("1992");
    expect(token.toLowerCase()).not.toContain("amritsar");
  });

  it("rejects a token whose calculation id was swapped", () => {
    const token = createContinuationToken(CALCULATION_ID);
    const [, expiresAt, signature] = token.split(".");
    const forged = `11111111-2222-3333-4444-555555555555.${expiresAt}.${signature}`;

    expect(readContinuationToken(forged)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createContinuationToken(CALCULATION_ID);
    const [id, expiresAt] = token.split(".");

    expect(readContinuationToken(`${id}.${expiresAt}.not-a-real-signature`)).toBeNull();
  });

  it("rejects an extended expiry", () => {
    const token = createContinuationToken(CALCULATION_ID);
    const [id, expiresAt, signature] = token.split(".");
    const extended = `${id}.${Number(expiresAt) + 86_400_000}.${signature}`;

    expect(readContinuationToken(extended)).toBeNull();
  });

  it("rejects an expired token", () => {
    const issuedAt = Date.now() - 60 * 60 * 1000;
    const token = createContinuationToken(CALCULATION_ID, issuedAt);

    expect(readContinuationToken(token, issuedAt)).toBe(CALCULATION_ID);
    expect(readContinuationToken(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(readContinuationToken(undefined)).toBeNull();
    expect(readContinuationToken("")).toBeNull();
    expect(readContinuationToken("not-a-token")).toBeNull();
    expect(readContinuationToken("a.b")).toBeNull();
    expect(readContinuationToken("a.b.c.d")).toBeNull();
  });
});
