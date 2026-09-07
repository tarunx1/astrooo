import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Authenticated encryption for stored provider credentials.
 *
 * AES-256-GCM, from Node's own crypto: no dependency, and an authenticated mode
 * so a tampered ciphertext fails loudly instead of decrypting to rubbish that
 * then gets sent to a payment provider.
 *
 * The envelope is self-describing. Recording the algorithm and a key version
 * alongside the ciphertext is what makes key rotation possible later without
 * guessing how any given row was written.
 *
 * The root key lives only in the environment. It is never stored in the
 * database, never editable from the admin, never returned to a browser and
 * never logged - if it were any of those, encrypting at rest would buy nothing.
 */
const ALGORITHM = "aes-256-gcm";
const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const KEY_BYTES = 32;

export type SecretEnvelope = {
  v: number;
  alg: string;
  keyVersion: number;
  iv: string;
  ct: string;
  tag: string;
};

export class SecretCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretCryptoError";
  }
}

/**
 * Resolves the root key.
 *
 * Accepts base64 or hex so an operator can paste whatever their secret manager
 * produced, but insists on a full 256 bits: a short key would silently weaken
 * every secret in the table.
 */
export function resolveRootKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.CONFIG_ENCRYPTION_KEY?.trim();

  if (!raw) {
    throw new SecretCryptoError(
      "CONFIG_ENCRYPTION_KEY is not set. Stored provider credentials cannot be read or written without it.",
    );
  }

  const decoded = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");

  if (decoded.length !== KEY_BYTES) {
    throw new SecretCryptoError(
      `CONFIG_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (256 bits); got ${decoded.length}.`,
    );
  }

  return decoded;
}

/** True when a usable root key is present, without throwing. For status pages. */
export function hasRootKey(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    resolveRootKey(env);
    return true;
  } catch {
    return false;
  }
}

/** Encrypts one secret. A fresh IV per call, so identical inputs never match. */
export function encryptSecret(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = resolveRootKey(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  const envelope: SecretEnvelope = {
    v: ENVELOPE_VERSION,
    alg: ALGORITHM,
    keyVersion: 1,
    iv: iv.toString("base64"),
    ct: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };

  return JSON.stringify(envelope);
}

function parseEnvelope(serialized: string): SecretEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new SecretCryptoError("Stored secret is not a readable envelope.");
  }

  const envelope = parsed as Partial<SecretEnvelope>;

  if (
    typeof envelope?.iv !== "string" ||
    typeof envelope?.ct !== "string" ||
    typeof envelope?.tag !== "string" ||
    typeof envelope?.alg !== "string" ||
    typeof envelope?.v !== "number"
  ) {
    throw new SecretCryptoError("Stored secret envelope is malformed.");
  }

  if (envelope.alg !== ALGORITHM) {
    throw new SecretCryptoError("Stored secret uses an unsupported algorithm.");
  }

  if (envelope.v !== ENVELOPE_VERSION) {
    throw new SecretCryptoError("Stored secret uses an unsupported envelope version.");
  }

  return envelope as SecretEnvelope;
}

/**
 * Decrypts one secret.
 *
 * Throws on a tampered ciphertext, a tampered tag or the wrong key. Every
 * failure is the same error type and carries no detail about the stored value,
 * so a caller cannot use failures to probe it.
 */
export function decryptSecret(serialized: string, env: NodeJS.ProcessEnv = process.env): string {
  const envelope = parseEnvelope(serialized);
  const key = resolveRootKey(env);

  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");

  if (iv.length !== IV_BYTES) throw new SecretCryptoError("Stored secret envelope is malformed.");

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Deliberately opaque: an attacker who can trigger this learns only that it
    // failed, never how far the decryption got.
    throw new SecretCryptoError("Stored secret could not be decrypted.");
  }
}

/** Constant-time compare, for verifying a value without leaking via timing. */
export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
