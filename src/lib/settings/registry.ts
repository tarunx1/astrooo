import { z } from "zod";

/**
 * The complete list of configuration an operator may change at runtime.
 *
 * This is an allowlist, not a convention. A key that is not declared here is
 * refused on write and ignored on read, which is what stops the settings table
 * becoming a general environment editor: there is no path from the admin UI to
 * a value that has not been given a schema, a category and a consumer.
 *
 * Root-of-trust values are deliberately absent - database credentials, the auth
 * signing key, the encryption key itself, the worker secret and the proxy
 * topology. Those stay in the environment, because anything editable from a
 * browser session is only as strong as that session.
 */
export const SETTING_CATEGORIES = [
  "site",
  "payments",
  "ai",
  "astrology",
  "features",
  "navigation",
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

/** Bounded so a stored value can never become a denial-of-service payload. */
const shortText = z.string().trim().max(120);
const mediumText = z.string().trim().max(400);

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an https:// URL");

export const socialLinkSchema = z.object({
  label: shortText.min(1),
  url: httpsUrl,
});

/**
 * One editable setting.
 *
 * `envFallback` names the environment variable this value falls back to, which
 * is what lets an existing deployment keep working before anything is saved
 * through the admin.
 */
type SettingDefinition<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  category: SettingCategory;
  schema: T;
  /** Used when neither the database nor the environment provides a value. */
  fallback: z.infer<T>;
  label: string;
  description?: string;
};

export const SETTINGS = {
  "site.name": {
    category: "site",
    schema: shortText.min(1),
    fallback: "Ravish Astro",
    label: "Site name",
  },
  "site.legalName": {
    category: "site",
    schema: shortText,
    fallback: "",
    label: "Legal or business name",
  },
  "site.supportEmail": {
    category: "site",
    schema: z.string().trim().email().max(200).or(z.literal("")),
    fallback: "",
    label: "Support email",
    description: "Shown to customers on contact surfaces.",
  },
  "site.contactPhone": {
    category: "site",
    schema: shortText,
    fallback: "",
    label: "Contact phone",
  },
  "site.contactAddress": {
    category: "site",
    schema: mediumText,
    fallback: "",
    label: "Business address",
  },
  "site.announcement": {
    category: "site",
    schema: mediumText,
    fallback: "",
    label: "Announcement banner",
    description: "Leave empty to hide the banner.",
  },
  "site.socialLinks": {
    category: "site",
    schema: z.array(socialLinkSchema).max(8),
    fallback: [] as z.infer<typeof socialLinkSchema>[],
    label: "Social links",
  },

  "payments.enabled": {
    category: "payments",
    schema: z.boolean(),
    fallback: false,
    label: "Accept payments",
  },
  "payments.mode": {
    category: "payments",
    schema: z.enum(["TEST", "LIVE"]),
    fallback: "TEST" as const,
    label: "Payment mode",
  },
  "payments.razorpayKeyId": {
    category: "payments",
    // Publishable by design: this one reaches the checkout client, so it is a
    // setting rather than a secret. The key secret never does.
    schema: z.string().trim().max(120),
    fallback: "",
    label: "Razorpay key ID",
  },

  "ai.enabled": {
    category: "ai",
    schema: z.boolean(),
    fallback: false,
    label: "Report generation",
  },
  "ai.model": {
    category: "ai",
    schema: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]),
    fallback: "gemini-2.5-flash" as const,
    label: "Model",
  },
  "ai.timeoutMs": {
    category: "ai",
    schema: z.number().int().min(1_000).max(120_000),
    fallback: 30_000,
    label: "Timeout (ms)",
  },
  "ai.retryCount": {
    category: "ai",
    schema: z.number().int().min(0).max(5),
    fallback: 1,
    label: "Retries",
  },

  "astrology.timeoutMs": {
    category: "astrology",
    schema: z.number().int().min(1_000).max(60_000),
    fallback: 10_000,
    label: "Timeout (ms)",
  },
  "astrology.retryCount": {
    category: "astrology",
    schema: z.number().int().min(0).max(5),
    fallback: 1,
    label: "Retries",
  },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SETTINGS)[K]["schema"]>;

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(SETTINGS, key);
}

/**
 * Secrets an operator may replace at runtime.
 *
 * Write-only by construction: there is no read path that returns plaintext to a
 * browser, only `configured: true`. `envFallback` keeps existing deployments
 * working before anything is saved here.
 */
export const SECRETS = {
  "payments.razorpayKeySecret": { envFallback: "RAZORPAY_KEY_SECRET", label: "Razorpay key secret" },
  "payments.razorpayWebhookSecret": { envFallback: "RAZORPAY_WEBHOOK_SECRET", label: "Razorpay webhook secret" },
  "ai.apiKey": { envFallback: "AI_PROVIDER_API_KEY", label: "AI provider API key" },
  "astrology.apiKey": { envFallback: "VEDASTRO_API_KEY", label: "VedAstro API key" },
} as const;

export type SecretKey = keyof typeof SECRETS;

export function isSecretKey(key: string): key is SecretKey {
  return Object.hasOwn(SECRETS, key);
}

/**
 * Values that stay in the environment.
 *
 * Listed here so the status page can report whether each is present without
 * ever offering to edit or display one. Rate-limit identity, job authentication
 * and the encryption root all belong to the host, not to a browser session.
 */
export const ENVIRONMENT_MANAGED = [
  { key: "DATABASE_URL", label: "Database", reason: "Connection credentials belong to the host." },
  { key: "BETTER_AUTH_SECRET", label: "Auth signing key", reason: "Rotating this signs out every user." },
  { key: "CONFIG_ENCRYPTION_KEY", label: "Encryption root", reason: "Protects every stored secret." },
  { key: "JOBS_SECRET", label: "Report worker secret", reason: "Internal service authentication." },
  { key: "TRUSTED_PROXY_PLATFORM", label: "Proxy topology", reason: "Rate-limit identity depends on it." },
  { key: "UPSTASH_REDIS_REST_URL", label: "Rate-limit store", reason: "Brute-force protection depends on it." },
  { key: "STORAGE_BUCKET", label: "Report storage", reason: "Configured with the deployment." },
  { key: "EMAIL_PROVIDER_API_KEY", label: "Transactional email", reason: "No provider is implemented yet." },
] as const;
