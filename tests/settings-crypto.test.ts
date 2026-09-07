import { describe, expect, it, vi } from "vitest";
import {
  SecretCryptoError,
  decryptSecret,
  encryptSecret,
  hasRootKey,
  resolveRootKey,
  secretsMatch,
} from "@/lib/settings/crypto";

/**
 * Encryption of stored provider credentials.
 *
 * The properties worth proving are the ones an attacker with database access
 * would test: that the plaintext is not recoverable from the row, that editing
 * the row is detected rather than silently accepted, and that the key actually
 * matters.
 */
const KEY = Buffer.alloc(32, 7).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 9).toString("base64");
const env = (value?: string) => ({ CONFIG_ENCRYPTION_KEY: value }) as unknown as NodeJS.ProcessEnv;

const SECRET = "rzp_test_51H8example_secret_value";

describe("root key", () => {
  it("accepts a 256-bit key as base64 or hex", () => {
    expect(resolveRootKey(env(KEY))).toHaveLength(32);
    expect(resolveRootKey(env(Buffer.alloc(32, 3).toString("hex")))).toHaveLength(32);
  });

  it("refuses a missing key rather than falling back to plaintext", () => {
    expect(() => resolveRootKey(env(undefined))).toThrow(SecretCryptoError);
    expect(() => resolveRootKey(env("   "))).toThrow(SecretCryptoError);
    expect(hasRootKey(env(undefined))).toBe(false);
  });

  it("refuses a key that is not 256 bits", () => {
    // A short key would silently weaken every secret in the table.
    expect(() => resolveRootKey(env(Buffer.alloc(16, 1).toString("base64")))).toThrow(/256 bits/);
  });
});

describe("encrypt and decrypt", () => {
  it("round-trips a secret", () => {
    expect(decryptSecret(encryptSecret(SECRET, env(KEY)), env(KEY))).toBe(SECRET);
  });

  it("round-trips unicode and long values", () => {
    const awkward = `${"ключ-".repeat(50)}🔐`;
    expect(decryptSecret(encryptSecret(awkward, env(KEY)), env(KEY))).toBe(awkward);
  });

  it("uses a fresh iv every time, so identical secrets never look identical", () => {
    const a = JSON.parse(encryptSecret(SECRET, env(KEY)));
    const b = JSON.parse(encryptSecret(SECRET, env(KEY)));

    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("records algorithm and key version, so rotation is possible later", () => {
    const envelope = JSON.parse(encryptSecret(SECRET, env(KEY)));
    expect(envelope).toMatchObject({ v: 1, alg: "aes-256-gcm", keyVersion: 1 });
    expect(typeof envelope.tag).toBe("string");
  });
});

describe("the envelope never contains the plaintext", () => {
  it("holds no readable trace of the secret", () => {
    const serialized = encryptSecret(SECRET, env(KEY));

    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("rzp_test");
    // Nor after decoding each field: ciphertext must not be an encoding trick.
    const envelope = JSON.parse(serialized);
    for (const field of ["iv", "ct", "tag"]) {
      expect(Buffer.from(envelope[field], "base64").toString("utf8")).not.toContain("rzp_test");
    }
  });
});

describe("tampering is detected", () => {
  it("rejects a modified ciphertext", () => {
    const envelope = JSON.parse(encryptSecret(SECRET, env(KEY)));
    const bytes = Buffer.from(envelope.ct, "base64");
    bytes[0] ^= 0xff;
    envelope.ct = bytes.toString("base64");

    expect(() => decryptSecret(JSON.stringify(envelope), env(KEY))).toThrow(SecretCryptoError);
  });

  it("rejects a modified auth tag", () => {
    const envelope = JSON.parse(encryptSecret(SECRET, env(KEY)));
    const tag = Buffer.from(envelope.tag, "base64");
    tag[0] ^= 0xff;
    envelope.tag = tag.toString("base64");

    expect(() => decryptSecret(JSON.stringify(envelope), env(KEY))).toThrow(SecretCryptoError);
  });

  it("rejects a modified iv", () => {
    const envelope = JSON.parse(encryptSecret(SECRET, env(KEY)));
    const iv = Buffer.from(envelope.iv, "base64");
    iv[0] ^= 0xff;
    envelope.iv = iv.toString("base64");

    expect(() => decryptSecret(JSON.stringify(envelope), env(KEY))).toThrow(SecretCryptoError);
  });

  it("rejects a downgraded algorithm or version", () => {
    const base = JSON.parse(encryptSecret(SECRET, env(KEY)));
    expect(() => decryptSecret(JSON.stringify({ ...base, alg: "aes-128-cbc" }), env(KEY))).toThrow(/algorithm/);
    expect(() => decryptSecret(JSON.stringify({ ...base, v: 99 }), env(KEY))).toThrow(/version/);
  });
});

describe("the key matters", () => {
  it("cannot decrypt with a different key", () => {
    const serialized = encryptSecret(SECRET, env(KEY));
    expect(() => decryptSecret(serialized, env(OTHER_KEY))).toThrow(SecretCryptoError);
  });

  it("fails safely when the key is gone rather than returning anything", () => {
    const serialized = encryptSecret(SECRET, env(KEY));
    expect(() => decryptSecret(serialized, env(undefined))).toThrow(SecretCryptoError);
  });
});

describe("malformed input", () => {
  it("refuses anything that is not an envelope", () => {
    for (const bad of ["", "not json", "{}", '{"v":1}', '"a string"', "[]", JSON.stringify({ v: 1, alg: "aes-256-gcm" })]) {
      expect(() => decryptSecret(bad, env(KEY)), bad).toThrow(SecretCryptoError);
    }
  });
});

describe("failures leak nothing", () => {
  it("never puts the secret or the key in an error message", () => {
    const serialized = encryptSecret(SECRET, env(KEY));

    const errors: string[] = [];
    for (const attempt of [
      () => decryptSecret(serialized, env(OTHER_KEY)),
      () => decryptSecret(serialized, env(undefined)),
      () => decryptSecret("garbage", env(KEY)),
    ]) {
      try {
        attempt();
      } catch (error) {
        errors.push(String(error));
      }
    }

    expect(errors).toHaveLength(3);
    for (const message of errors) {
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain(KEY);
      expect(message).not.toContain(OTHER_KEY);
    }
  });

  it("does not log while encrypting or decrypting", () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    decryptSecret(encryptSecret(SECRET, env(KEY)), env(KEY));
    try {
      decryptSecret("garbage", env(KEY));
    } catch {
      // expected
    }

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("constant-time comparison", () => {
  it("matches equal values and rejects others without throwing on length", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abc", "abd")).toBe(false);
    expect(secretsMatch("abc", "abcd")).toBe(false);
    expect(secretsMatch("", "")).toBe(true);
  });
});
