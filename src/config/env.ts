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
  AI_PROVIDER_API_KEY: z.string().optional(),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
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

  if (missing.length > 0) {
    throw new Error(`Missing required production environment configuration: ${missing.join(", ")}`);
  }
}
