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
  "payouts",
  "consultations",
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
    fallback: "Tarun Astro",
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

  /* ---------------------------------------------------------------- */
  /* Payouts                                                           */
  /*                                                                   */
  /* The payout cycle is configuration, not a constant buried in a      */
  /* scheduler: a platform that decides to pay weekly instead of        */
  /* monthly should not need a deploy, and a rule that lives in one     */
  /* declared place is one an operator can actually audit.              */
  /* ---------------------------------------------------------------- */
  "payouts.cycle": {
    category: "payouts",
    schema: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "MANUAL"]),
    fallback: "MONTHLY",
    label: "Payout cycle",
    description: "How often eligible earnings are gathered into a payout.",
  },
  "payouts.cycleAnchorDay": {
    category: "payouts",
    schema: z.number().int().min(1).max(28),
    fallback: 1,
    label: "Cycle day",
    description:
      "Day of the week (1 = Monday) for weekly cycles, or day of the month for monthly. Capped at 28 so every month has one.",
  },
  "payouts.holdingPeriodDays": {
    category: "payouts",
    schema: z.number().int().min(0).max(90),
    fallback: 7,
    label: "Holding period (days)",
    description: "How long after a consultation completes before its earning becomes payable.",
  },
  "payouts.minimumPaise": {
    category: "payouts",
    schema: z.number().int().min(0).max(10_000_000),
    fallback: 50_000,
    label: "Minimum payout",
    description: "Earnings below this stay eligible and roll into the next cycle.",
  },
  "payouts.platformCommissionPercent": {
    category: "payouts",
    schema: z.number().int().min(0).max(90),
    fallback: 20,
    label: "Platform commission (%)",
    description: "Default share of a consultation the platform keeps. A Pandit may carry an override.",
  },
  "payouts.automatic": {
    category: "payouts",
    schema: z.boolean(),
    fallback: false,
    label: "Automatic transfers",
    description:
      "Off, and not switchable on until a payout provider is wired. The ledger and states are real; no money moves from this application.",
  },

  /* ---------------------------------------------------------------- */
  /* Consultations                                                     */
  /*                                                                   */
  /* Rate bounds are platform policy. They are checked when a Pandit    */
  /* saves a rate, and deliberately not stored on the service row, so   */
  /* widening the ceiling later never silently reprices anybody.        */
  /* ---------------------------------------------------------------- */
  "consultations.enabled": {
    category: "consultations",
    schema: z.boolean(),
    fallback: true,
    label: "Consultations enabled",
  },
  "consultations.allowedModes": {
    category: "consultations",
    schema: z.array(z.enum(["CHAT", "VOICE_CALL", "VIDEO_CALL"])).max(3),
    fallback: ["CHAT", "VOICE_CALL", "VIDEO_CALL"],
    label: "Allowed consultation types",
  },
  "consultations.minRatePaise": {
    category: "consultations",
    schema: z.number().int().min(0).max(10_000_000),
    fallback: 1_000,
    label: "Minimum rate",
  },
  "consultations.maxRatePaise": {
    category: "consultations",
    schema: z.number().int().min(0).max(10_000_000),
    fallback: 50_000,
    label: "Maximum rate",
  },
  "consultations.maxAdvanceDays": {
    category: "consultations",
    schema: z.number().int().min(1).max(180),
    fallback: 30,
    label: "Booking window (days)",
    description: "How far ahead a customer may book.",
  },
  "consultations.minNoticeMinutes": {
    category: "consultations",
    schema: z.number().int().min(0).max(10_080),
    fallback: 60,
    label: "Minimum notice (minutes)",
    description: "How soon before a slot a customer may still book it.",
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
  "email.apiKey": { envFallback: "EMAIL_PROVIDER_API_KEY", label: "Transactional email API key" },
  "sms.apiKey": { envFallback: "SMS_PROVIDER_API_KEY", label: "SMS provider API key" },
  "whatsapp.apiKey": { envFallback: "WHATSAPP_PROVIDER_API_KEY", label: "WhatsApp provider API key" },
  "calls.appId": { envFallback: "CALL_PROVIDER_APP_ID", label: "Calling provider app id" },
  "calls.appSecret": { envFallback: "CALL_PROVIDER_APP_SECRET", label: "Calling provider app secret" },
  "storage.accessKeyId": { envFallback: "STORAGE_ACCESS_KEY_ID", label: "Object storage access key id" },
  "storage.secretAccessKey": { envFallback: "STORAGE_SECRET_ACCESS_KEY", label: "Object storage secret key" },
  "maps.apiKey": { envFallback: "MAPS_PROVIDER_API_KEY", label: "Maps/geocoding API key" },
  "analytics.apiKey": { envFallback: "ANALYTICS_PROVIDER_API_KEY", label: "Analytics provider API key" },
  "push.apiKey": { envFallback: "PUSH_PROVIDER_API_KEY", label: "Push notification API key" },
  "payouts.providerKeyId": { envFallback: "PAYOUT_PROVIDER_KEY_ID", label: "Payout provider key id" },
  "payouts.providerKeySecret": { envFallback: "PAYOUT_PROVIDER_KEY_SECRET", label: "Payout provider key secret" },
  "payouts.providerWebhookSecret": { envFallback: "PAYOUT_PROVIDER_WEBHOOK_SECRET", label: "Payout provider webhook secret" },
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
] as const;
