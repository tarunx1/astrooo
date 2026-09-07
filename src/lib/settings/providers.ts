import "server-only";

import { describeSecret, getSecret, getSettings } from "@/lib/settings/service";

/**
 * Provider configuration, resolved coherently.
 *
 * The rule that matters here: a provider's credentials are taken as a bundle,
 * from one source. Mixing a key id saved through the admin with a key secret
 * left in the environment would produce a pair that never existed together and
 * fail in a way nobody could reason about, so a bundle is used only when every
 * part of it is present from the same place.
 *
 * Precedence is admin-first, then environment, then unconfigured.
 */
export type IntegrationStatus = {
  configured: boolean;
  source: "admin" | "environment" | "none";
  /** True only when the operator has also switched it on. */
  enabled: boolean;
  detail?: string;
};

export type RazorpayRuntimeConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  mode: "TEST" | "LIVE";
};

/**
 * Razorpay credentials for server use, or null when incomplete.
 *
 * Returning null rather than a partial config is deliberate: a half-configured
 * payment provider must not be reachable, and checkout stays disabled.
 */
export async function getRazorpayConfig(
  env: NodeJS.ProcessEnv = process.env,
): Promise<RazorpayRuntimeConfig | null> {
  const settings = await getSettings(["payments.razorpayKeyId", "payments.mode"]);

  const adminKeyId = settings["payments.razorpayKeyId"];
  const adminSecret = await getSecret("payments.razorpayKeySecret", env);
  const adminWebhook = await getSecret("payments.razorpayWebhookSecret", env);

  // The bundle is complete only when the id and the secret are both present.
  if (adminKeyId && adminSecret) {
    return {
      keyId: adminKeyId,
      keySecret: adminSecret,
      webhookSecret: adminWebhook,
      mode: settings["payments.mode"],
    };
  }

  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return {
      keyId: env.RAZORPAY_KEY_ID,
      keySecret: env.RAZORPAY_KEY_SECRET,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET ?? null,
      mode: settings["payments.mode"],
    };
  }

  return null;
}

export async function getRazorpayStatus(env: NodeJS.ProcessEnv = process.env): Promise<IntegrationStatus> {
  const settings = await getSettings(["payments.enabled", "payments.razorpayKeyId", "payments.mode"]);
  const secret = await describeSecret("payments.razorpayKeySecret", env);

  const fromAdmin = Boolean(settings["payments.razorpayKeyId"]) && secret.source === "admin";
  const fromEnv = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);

  const source = fromAdmin ? "admin" : fromEnv ? "environment" : "none";

  return {
    configured: source !== "none",
    source,
    // Credentials existing is never the same as being switched on. Live payment
    // acceptance is always a deliberate act.
    enabled: source !== "none" && settings["payments.enabled"],
    detail: source === "none" ? undefined : `${settings["payments.mode"]} mode`,
  };
}

export type AIRuntimeConfig = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  retryCount: number;
};

export async function getAIConfig(env: NodeJS.ProcessEnv = process.env): Promise<AIRuntimeConfig | null> {
  const settings = await getSettings(["ai.model", "ai.timeoutMs", "ai.retryCount"]);
  const apiKey = await getSecret("ai.apiKey", env);
  if (!apiKey) return null;

  return {
    apiKey,
    model: settings["ai.model"],
    timeoutMs: settings["ai.timeoutMs"],
    retryCount: settings["ai.retryCount"],
  };
}

export async function getAIStatus(env: NodeJS.ProcessEnv = process.env): Promise<IntegrationStatus> {
  const settings = await getSettings(["ai.enabled", "ai.model"]);
  const secret = await describeSecret("ai.apiKey", env);

  return {
    configured: secret.configured,
    source: secret.source,
    enabled: secret.configured && settings["ai.enabled"],
    detail: secret.configured ? settings["ai.model"] : undefined,
  };
}

export type AstrologyRuntimeConfig = {
  apiKey: string | null;
  timeoutMs: number;
  retryCount: number;
};

/**
 * VedAstro configuration.
 *
 * Unlike the others this provider works without a key on its free tier, so it
 * is reported as available rather than missing when none is set. The status
 * says which of the two it is instead of implying a capability that has not
 * been confirmed.
 */
export async function getAstrologyConfig(env: NodeJS.ProcessEnv = process.env): Promise<AstrologyRuntimeConfig> {
  const settings = await getSettings(["astrology.timeoutMs", "astrology.retryCount"]);

  return {
    apiKey: await getSecret("astrology.apiKey", env),
    timeoutMs: settings["astrology.timeoutMs"],
    retryCount: settings["astrology.retryCount"],
  };
}

export async function getAstrologyStatus(env: NodeJS.ProcessEnv = process.env): Promise<IntegrationStatus> {
  const secret = await describeSecret("astrology.apiKey", env);

  return {
    configured: true,
    source: secret.source,
    enabled: true,
    detail: secret.configured ? "API key configured" : "Anonymous free-tier access",
  };
}
