import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_PROVIDER: z.literal("razorpay").optional(),
  REPORT_CHECKOUT_ENABLED: z.enum(["true", "false"]).optional(),
  AI_PROVIDER: z.enum(["gemini", "development"]).optional(),
  AI_MODEL: z.string().optional(),
  AI_PROVIDER_API_KEY: z.string().optional(),
  JOBS_SECRET: z.string().min(16).optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  SMS_PROVIDER_API_KEY: z.string().optional(),
  WHATSAPP_PROVIDER_API_KEY: z.string().optional(),
  // Voice and video consultations. Both halves are required together; a key id
  // from one place and a secret from another is a pair that never existed.
  CALL_PROVIDER_APP_ID: z.string().optional(),
  CALL_PROVIDER_APP_SECRET: z.string().optional(),
  // Automated practitioner disbursement.
  PAYOUT_PROVIDER_KEY_ID: z.string().optional(),
  PAYOUT_PROVIDER_KEY_SECRET: z.string().optional(),
  PAYOUT_PROVIDER_WEBHOOK_SECRET: z.string().optional(),
  MAPS_PROVIDER_API_KEY: z.string().optional(),
  ANALYTICS_PROVIDER_API_KEY: z.string().optional(),
  PUSH_PROVIDER_API_KEY: z.string().optional(),
  // Distributed rate limit store. Both are server-only credentials.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Deployment shape. Decides which forwarding header may be trusted to
  // identify a client; see lib/security/client-ip.ts.
  TRUSTED_PROXY_PLATFORM: z.enum(["vercel", "cloudflare", "fly", "generic", "none"]).optional(),
  TRUSTED_PROXY_HOPS: z.string().regex(/^\d+$/).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  // Root of trust for credentials stored through the admin. Never stored in the
  // database, never editable from a browser, never returned to one.
  CONFIG_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse(process.env);
}

/**
 * Fails fast when a production deployment is missing something authentication
 * cannot work without. Call this from server startup paths, not from the browser
 * bundle - it reads server-only values.
 */
export function assertProductionAuthEnv(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const missing: string[] = [];

  const secret = env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET;
  if (!secret || secret.length < 16) missing.push("BETTER_AUTH_SECRET");
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");

  // Google is the only production sign-in method, so a half-configured pair is
  // treated as an error rather than silently disabling sign-in.
  const hasId = Boolean(env.GOOGLE_CLIENT_ID);
  const hasSecret = Boolean(env.GOOGLE_CLIENT_SECRET);
  if (hasId !== hasSecret) missing.push("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together");

  if (env.REPORT_CHECKOUT_ENABLED === "true") {
    if (env.PAYMENT_PROVIDER && env.PAYMENT_PROVIDER !== "razorpay") missing.push("PAYMENT_PROVIDER=razorpay");
    if (!env.RAZORPAY_KEY_ID) missing.push("RAZORPAY_KEY_ID");
    if (!env.RAZORPAY_KEY_SECRET) missing.push("RAZORPAY_KEY_SECRET");
    if (!env.RAZORPAY_WEBHOOK_SECRET) missing.push("RAZORPAY_WEBHOOK_SECRET");
  }

  // Rate limiting must be distributed in production. A process-local counter
  // would reset on every deploy and be independent per instance, which is not a
  // rate limit at all.
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    missing.push("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (distributed rate limiting)");
  }

  // Without this, no forwarding header is trusted and every anonymous caller
  // shares one rate-limit bucket. That is safe but coarse, so production must
  // state its topology deliberately rather than inherit the fallback.
  if (!env.TRUSTED_PROXY_PLATFORM || env.TRUSTED_PROXY_PLATFORM === "none") {
    missing.push("TRUSTED_PROXY_PLATFORM (set to the hosting platform, or 'generic' behind your own proxy)");
  }

  /**
   * The encryption root.
   *
   * Required in production now that practitioners store payout details. Without
   * it the application refuses to store bank details at all - which is the
   * right refusal, but discovering it when a practitioner first tries to get
   * paid is the wrong time.
   */
  if (!env.CONFIG_ENCRYPTION_KEY || env.CONFIG_ENCRYPTION_KEY.length < 32) {
    missing.push("CONFIG_ENCRYPTION_KEY (protects stored payout and provider credentials)");
  }

  /**
   * Private document storage.
   *
   * Practitioner verification documents are identity documents. In production
   * they must go to object storage, not the local filesystem, because a
   * filesystem on an ephemeral instance loses them and a shared one is not
   * access-controlled. `getStorageProvider` refuses in production anyway; this
   * turns that into a startup failure rather than a first-upload failure.
   */
  const storageParts = [
    env.STORAGE_BUCKET,
    env.STORAGE_ACCESS_KEY_ID,
    env.STORAGE_SECRET_ACCESS_KEY,
  ];

  if (storageParts.some((part) => !part)) {
    missing.push("STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY (private document storage)");
  }

  // Half-configured provider bundles are worse than none: they fail at the
  // provider, at the worst moment, in a way nobody can reason about.
  assertPair(env.CALL_PROVIDER_APP_ID, env.CALL_PROVIDER_APP_SECRET, "CALL_PROVIDER_APP_ID and CALL_PROVIDER_APP_SECRET", missing);
  assertPair(env.PAYOUT_PROVIDER_KEY_ID, env.PAYOUT_PROVIDER_KEY_SECRET, "PAYOUT_PROVIDER_KEY_ID and PAYOUT_PROVIDER_KEY_SECRET", missing);

  if (missing.length > 0) {
    throw new Error(`Missing required production environment configuration: ${missing.join(", ")}`);
  }
}

/** Both halves of a credential pair, or neither. */
function assertPair(
  first: string | undefined,
  second: string | undefined,
  label: string,
  missing: string[],
): void {
  if (Boolean(first) !== Boolean(second)) {
    missing.push(`${label} must be set together`);
  }
}
