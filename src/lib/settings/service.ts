import "server-only";

import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret, hasRootKey } from "@/lib/settings/crypto";
import {
  SECRETS,
  SETTINGS,
  isSecretKey,
  isSettingKey,
  type SecretKey,
  type SettingKey,
  type SettingValue,
} from "@/lib/settings/registry";

/**
 * The one place runtime configuration is read and written.
 *
 * Everything goes through here rather than querying the settings tables
 * directly, so validation, the environment fallback, cache invalidation and the
 * secret boundary are enforced in a single place instead of being re-derived at
 * each call site.
 */

/**
 * Per-process cache.
 *
 * Settings are read on nearly every render and change rarely. The cache is
 * cleared on write; it is deliberately short-lived as well, so a change made on
 * one instance reaches the others without needing a deploy or a shared bus.
 */
const CACHE_TTL_MS = 30_000;

let settingsCache: { values: Map<string, unknown>; expiresAt: number } | null = null;

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

async function loadSettings(): Promise<Map<string, unknown>> {
  const now = Date.now();
  if (settingsCache && settingsCache.expiresAt > now) return settingsCache.values;

  const rows = await prisma.systemSetting.findMany({ select: { key: true, valueJson: true } });
  const values = new Map<string, unknown>(rows.map((row) => [row.key, row.valueJson]));

  settingsCache = { values, expiresAt: now + CACHE_TTL_MS };
  return values;
}

/**
 * Reads one setting.
 *
 * A stored value that no longer satisfies its schema is discarded rather than
 * returned: the registry may have tightened since it was written, and a stale
 * value that fails validation should not propagate into provider config.
 */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const definition = SETTINGS[key];
  const stored = (await loadSettings()).get(key);

  if (stored !== undefined) {
    const parsed = definition.schema.safeParse(stored);
    if (parsed.success) return parsed.data as SettingValue<K>;
  }

  return definition.fallback as SettingValue<K>;
}

/** Reads every setting in one pass, for a settings screen. */
export async function getSettings<K extends SettingKey>(keys: readonly K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const values = await loadSettings();
  const out = {} as { [P in K]: SettingValue<P> };

  for (const key of keys) {
    const definition = SETTINGS[key];
    const stored = values.get(key);
    const parsed = stored === undefined ? null : definition.schema.safeParse(stored);
    out[key] = (parsed?.success ? parsed.data : definition.fallback) as SettingValue<typeof key>;
  }

  return out;
}

/** Validates and stores one setting. Returns the value actually written. */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  actorUserId: string,
): Promise<SettingValue<K>> {
  if (!isSettingKey(key)) throw new Error("Unknown setting.");

  const definition = SETTINGS[key];
  const parsed = definition.schema.parse(value) as SettingValue<K>;

  await prisma.systemSetting.upsert({
    where: { key },
    update: { valueJson: parsed as never, updatedById: actorUserId, category: definition.category },
    create: { key, category: definition.category, valueJson: parsed as never, updatedById: actorUserId },
  });

  invalidateSettingsCache();
  return parsed;
}

/* ------------------------------------------------------------------ */
/* Secrets                                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolves a secret for server-side use.
 *
 * Never call this from anything that renders. The return value is plaintext and
 * belongs only in a provider client. The database is preferred over the
 * environment so an operator's replacement takes effect immediately.
 */
export async function getSecret(key: SecretKey, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (hasRootKey(env)) {
    const row = await prisma.systemSecret.findUnique({ where: { key }, select: { envelope: true } });

    if (row) {
      try {
        return decryptSecret(row.envelope, env);
      } catch {
        // A secret that cannot be decrypted is treated as absent rather than
        // falling back to the environment, because silently using a different
        // credential than the operator configured is worse than being
        // unconfigured. The status page reports the failure.
        return null;
      }
    }
  }

  return env[SECRETS[key].envFallback] || null;
}

/** Whether a secret exists at all, and where it came from. For status display. */
export async function describeSecret(
  key: SecretKey,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ configured: boolean; source: "admin" | "environment" | "none"; updatedAt: Date | null }> {
  if (hasRootKey(env)) {
    const row = await prisma.systemSecret.findUnique({ where: { key }, select: { updatedAt: true } });
    if (row) return { configured: true, source: "admin", updatedAt: row.updatedAt };
  }

  if (env[SECRETS[key].envFallback]) return { configured: true, source: "environment", updatedAt: null };
  return { configured: false, source: "none", updatedAt: null };
}

/** Encrypts and stores a secret. The plaintext is not retained anywhere else. */
export async function setSecret(key: SecretKey, plaintext: string, actorUserId: string): Promise<void> {
  if (!isSecretKey(key)) throw new Error("Unknown secret.");

  const trimmed = plaintext.trim();
  if (!trimmed) throw new Error("A replacement value is required.");
  if (trimmed.length > 4_000) throw new Error("That value is too long to be a credential.");

  const envelope = encryptSecret(trimmed);

  await prisma.systemSecret.upsert({
    where: { key },
    update: { envelope, updatedById: actorUserId },
    create: { key, envelope, updatedById: actorUserId },
  });

  invalidateSettingsCache();
}

/** Removes a stored secret, falling the provider back to the environment. */
export async function removeSecret(key: SecretKey): Promise<void> {
  await prisma.systemSecret.deleteMany({ where: { key } });
  invalidateSettingsCache();
}
