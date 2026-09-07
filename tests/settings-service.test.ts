import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/settings/crypto";
import { SETTINGS, isSecretKey, isSettingKey } from "@/lib/settings/registry";
import {
  describeSecret,
  getSecret,
  getSetting,
  invalidateSettingsCache,
  removeSecret,
  setSecret,
  setSetting,
} from "@/lib/settings/service";

/**
 * The settings service against real Postgres.
 *
 * The properties that matter are the ones the whole design rests on: that a key
 * outside the registry cannot be written, that a stored credential is
 * ciphertext on disk, that replacing one takes effect immediately, and that a
 * provider never ends up with half its credentials from one place and half from
 * another.
 */
const KEY = Buffer.alloc(32, 11).toString("base64");
const RUN = `set${Date.now().toString(36)}`;

let actorId: string;

beforeAll(async () => {
  process.env.CONFIG_ENCRYPTION_KEY = KEY;
  const user = await prisma.user.create({
    data: { name: "Settings Actor", email: `${RUN}@example.test`, emailVerified: true, role: UserRole.SUPER_ADMIN },
    select: { id: true },
  });
  actorId = user.id;
});

afterAll(async () => {
  await prisma.systemSetting.deleteMany({ where: { updatedById: actorId } });
  await prisma.systemSecret.deleteMany({ where: { updatedById: actorId } });
  await prisma.user.deleteMany({ where: { id: actorId } });
  delete process.env.CONFIG_ENCRYPTION_KEY;
  invalidateSettingsCache();
});

describe("the registry is an allowlist", () => {
  it("recognises only declared keys", () => {
    expect(isSettingKey("site.name")).toBe(true);
    expect(isSecretKey("ai.apiKey")).toBe(true);

    for (const forged of ["DATABASE_URL", "AUTH_SECRET", "CONFIG_ENCRYPTION_KEY", "__proto__", "site.name.evil"]) {
      expect(isSettingKey(forged), forged).toBe(false);
      expect(isSecretKey(forged), forged).toBe(false);
    }
  });

  it("declares no root-of-trust value as editable", () => {
    const editable = [...Object.keys(SETTINGS)].join(" ").toLowerCase();
    for (const forbidden of ["database_url", "auth_secret", "encryption", "jobs_secret", "proxy", "upstash"]) {
      expect(editable).not.toContain(forbidden);
    }
  });
});

describe("settings", () => {
  it("falls back to the declared default before anything is saved", async () => {
    invalidateSettingsCache();
    expect(await getSetting("ai.model")).toBe("gemini-2.5-flash");
  });

  it("stores and reads a value back", async () => {
    await setSetting("site.supportEmail", "help@example.test", actorId);
    expect(await getSetting("site.supportEmail")).toBe("help@example.test");
  });

  it("refuses a value that fails its schema", async () => {
    await expect(setSetting("site.supportEmail", "not-an-email", actorId)).rejects.toThrow();
    await expect(setSetting("ai.timeoutMs", 10, actorId)).rejects.toThrow();
    await expect(setSetting("payments.mode", "SANDBOX", actorId)).rejects.toThrow();
  });

  it("ignores a stored value that no longer satisfies its schema", async () => {
    // The registry may tighten after a value was written; a stale value must
    // not leak into provider configuration.
    await prisma.systemSetting.upsert({
      where: { key: "ai.retryCount" },
      update: { valueJson: 999 },
      create: { key: "ai.retryCount", category: "ai", valueJson: 999, updatedById: actorId },
    });
    invalidateSettingsCache();

    expect(await getSetting("ai.retryCount")).toBe(SETTINGS["ai.retryCount"].fallback);
  });
});

describe("secrets are ciphertext at rest", () => {
  it("never writes the plaintext to the row", async () => {
    const plaintext = `rzp_live_${RUN}_never_in_the_clear`;
    await setSecret("payments.razorpayKeySecret", plaintext, actorId);

    const row = await prisma.systemSecret.findUniqueOrThrow({
      where: { key: "payments.razorpayKeySecret" },
    });

    expect(JSON.stringify(row)).not.toContain(plaintext);
    expect(row.envelope).not.toContain(plaintext);
    expect(JSON.parse(row.envelope)).toMatchObject({ alg: "aes-256-gcm" });
  });

  it("resolves back to the original value on the server", async () => {
    const plaintext = `sk_${RUN}_roundtrip`;
    await setSecret("ai.apiKey", plaintext, actorId);
    expect(await getSecret("ai.apiKey")).toBe(plaintext);
  });

  it("describes a secret without revealing it", async () => {
    const described = await describeSecret("ai.apiKey");

    expect(described.configured).toBe(true);
    expect(described.source).toBe("admin");
    // The only things a browser is ever given.
    expect(Object.keys(described).sort()).toEqual(["configured", "source", "updatedAt"]);
    expect(JSON.stringify(described)).not.toContain(RUN);
  });

  it("rotates immediately, with the old value no longer resolving", async () => {
    await setSecret("ai.apiKey", "first-value", actorId);
    expect(await getSecret("ai.apiKey")).toBe("first-value");

    await setSecret("ai.apiKey", "second-value", actorId);
    // No stale cache: a replaced credential must take effect at once, or the
    // next payment would be signed with the key the operator just retired.
    expect(await getSecret("ai.apiKey")).toBe("second-value");
  });

  it("falls back to the environment only when nothing is stored", async () => {
    await removeSecret("payments.razorpayWebhookSecret");
    const env = { CONFIG_ENCRYPTION_KEY: KEY, RAZORPAY_WEBHOOK_SECRET: "from-environment" } as unknown as NodeJS.ProcessEnv;

    expect(await getSecret("payments.razorpayWebhookSecret", env)).toBe("from-environment");
    expect((await describeSecret("payments.razorpayWebhookSecret", env)).source).toBe("environment");

    await setSecret("payments.razorpayWebhookSecret", "from-admin", actorId);
    // Stored wins, so an operator's replacement is what actually gets used.
    expect(await getSecret("payments.razorpayWebhookSecret", env)).toBe("from-admin");
    expect((await describeSecret("payments.razorpayWebhookSecret", env)).source).toBe("admin");
  });

  it("treats an undecryptable secret as absent rather than using the environment", async () => {
    // Silently using a different credential than the operator configured would
    // be worse than being unconfigured.
    await prisma.systemSecret.upsert({
      where: { key: "payments.razorpayWebhookSecret" },
      update: { envelope: encryptSecret("value", { CONFIG_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64") } as unknown as NodeJS.ProcessEnv) },
      create: { key: "payments.razorpayWebhookSecret", envelope: "broken", updatedById: actorId },
    });

    const env = { CONFIG_ENCRYPTION_KEY: KEY, RAZORPAY_WEBHOOK_SECRET: "from-environment" } as unknown as NodeJS.ProcessEnv;
    expect(await getSecret("payments.razorpayWebhookSecret", env)).toBeNull();
  });

  it("refuses an empty replacement, so a secret cannot be blanked by accident", async () => {
    await expect(setSecret("ai.apiKey", "   ", actorId)).rejects.toThrow();
  });
});

describe("secret handling never logs the value", () => {
  it("writes and reads without printing anything", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    await setSecret("ai.apiKey", `loud_${RUN}`, actorId);
    await getSecret("ai.apiKey");

    const written = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(written).not.toContain(`loud_${RUN}`);
    vi.restoreAllMocks();
  });
});
