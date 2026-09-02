import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db/prisma";

/**
 * Server-only Better Auth instance.
 *
 * Session strategy is database-backed: Better Auth persists a `Session` row and
 * issues a signed, HttpOnly cookie holding only the opaque session token. No
 * provider tokens and no user attributes are ever exposed to the client.
 */
function readSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("BETTER_AUTH_SECRET must be set to a strong value in production.");
    }
    return "development-only-insecure-secret-value";
  }

  return secret;
}

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

/** Google is only registered when both credentials are present. */
export const isGoogleAuthConfigured = Boolean(googleClientId && googleClientSecret);

/**
 * Credential sign-in exists solely so automated tests and local development can
 * exercise the authenticated surface without live Google credentials. It is
 * disabled whenever NODE_ENV is production.
 */
export const isDevCredentialsEnabled =
  process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_CREDENTIALS === "true";

export const auth = betterAuth({
  appName: "Ravish Astro",
  secret: readSecret(),
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: isDevCredentialsEnabled,
  },
  socialProviders: isGoogleAuthConfigured
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : {},
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
