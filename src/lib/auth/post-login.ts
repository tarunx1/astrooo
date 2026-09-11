import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeReturnTo } from "@/lib/auth/return-url";
import { homePathForRole } from "@/lib/auth/permissions";

export const POST_LOGIN_PATH = "/post-login";
export const SUPER_ADMIN_DASHBOARD_PATH = "/admin/super";
export const BECOME_A_PANDIT_PATH = "/become-a-pandit";

/**
 * Where sign-in lands someone.
 *
 * Presentation only. Sending a Pandit to `/pandit` does not grant them
 * anything: that area gates on their own profile, and every staff area gates on
 * permission, so a person who arrived at the wrong destination is refused there
 * rather than admitted by the redirect.
 *
 * A deliberate `returnTo` wins over the role's default, because someone who
 * followed a link to a specific page and was asked to sign in meant to go
 * there. The exception is the generic destinations - `/` and the customer
 * account area - which are what a plain sign-in produces and are therefore not
 * evidence of intent.
 */
const GENERIC_DESTINATIONS = ["/", "/account"];

function isGeneric(path: string): boolean {
  return GENERIC_DESTINATIONS.includes(path) || path === "/account/";
}

export async function resolvePostLoginRedirect(
  returnTo?: string,
  mode?: string,
): Promise<string> {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  const user = await getCurrentUser();

  if (!user) return safeReturnTo;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, panditProfile: { select: { id: true } } },
  });

  if (!record) return safeReturnTo;

  // Someone who chose the Pandit entrance but has no application yet is sent to
  // the page that opens one, rather than to a dashboard that would 404 at them.
  // Choosing that entrance grants nothing; it only says where they expected to
  // land.
  if (isSignInMode(mode) && mode === "pandit" && !record.panditProfile) {
    return BECOME_A_PANDIT_PATH;
  }

  const home = record.role === UserRole.SUPER_ADMIN ? SUPER_ADMIN_DASHBOARD_PATH : homePathForRole(record.role);

  // A Super Admin always lands on their own dashboard; for everyone else a
  // specific destination they asked for is honoured.
  if (record.role === UserRole.SUPER_ADMIN) return home;

  return isGeneric(safeReturnTo) ? home : safeReturnTo;
}

/**
 * The destination for a chosen sign-in mode.
 *
 * The mode is a hint about where the person expects to land, not a claim about
 * who they are: picking "Team" does not make anyone staff. Whatever they pick,
 * `resolvePostLoginRedirect` re-reads their actual role from the database, and
 * the destination area authorizes independently - so a customer who chose
 * "Team" simply arrives at their own account.
 */
export type SignInMode = "customer" | "pandit" | "team";

export const SIGN_IN_MODES: readonly SignInMode[] = ["customer", "pandit", "team"];

export function isSignInMode(value: unknown): value is SignInMode {
  return typeof value === "string" && (SIGN_IN_MODES as readonly string[]).includes(value);
}

export function modeDestination(mode: SignInMode): string {
  switch (mode) {
    case "pandit":
      return "/pandit";
    case "team":
      return "/employee";
    default:
      return "/account";
  }
}
