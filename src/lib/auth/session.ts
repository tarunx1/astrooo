import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { buildSignInHref } from "@/lib/auth/return-url";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

/**
 * Reads the session from the request cookie.
 *
 * Wrapped in `cache` so that several server components rendering in the same
 * request share a single session lookup instead of creating a waterfall.
 */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ?? null;
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/**
 * Server-side gate for every protected page and mutation.
 *
 * This is the only sanctioned source of the acting user id. A userId supplied by
 * the browser is never trusted.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(buildSignInHref(returnTo));
  }
  return user;
}
