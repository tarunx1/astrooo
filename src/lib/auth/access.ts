import "server-only";

import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit, rateLimitMessage, type RateLimitNamespace } from "@/lib/security/rate-limit";
import {
  FULL_ACCESS,
  hasAnyPermission,
  hasPermission,
  resolvePermissions,
  type Permission,
} from "@/lib/auth/permissions";

/**
 * The single authorization gate for every staff-facing surface.
 *
 * One rule, applied everywhere: the acting identity comes from the server
 * session, the role and permission overrides are re-read from the database on
 * every request, and the decision is made against a permission - never against
 * a role name compared inline, and never against anything the browser sent.
 *
 * Re-reading rather than trusting the session payload is what makes revocation
 * take effect: a permission removed while someone is signed in stops working on
 * their next request instead of at their next sign-in.
 */
export type Viewer = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: ReadonlySet<Permission>;
  /** True only for SUPER_ADMIN. Used for presentation and for the few genuinely owner-level gates. */
  isSuperAdmin: boolean;
  /** Set when this person also has a Pandit profile, whatever its state. */
  panditProfileId: string | null;
  employeeActive: boolean;
};

/**
 * Resolves the acting viewer, or null when nobody is signed in.
 *
 * Cached per request so a page, its layout and its actions share one lookup
 * rather than issuing the same three queries each.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: { select: { permission: true, granted: true } },
      panditProfile: { select: { id: true } },
      employeeProfile: { select: { active: true } },
    },
  });

  if (!record) return null;

  // A deactivated staff member keeps their account but loses the bundle their
  // role would otherwise carry. Deactivation has to mean something on its own,
  // or an operator would have to remember to also change the role.
  const deactivated = record.role === UserRole.EMPLOYEE && record.employeeProfile?.active === false;

  const permissions = deactivated
    ? new Set<Permission>()
    : resolvePermissions(record.role, record.permissions);

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    permissions,
    isSuperAdmin: record.role === UserRole.SUPER_ADMIN,
    panditProfileId: record.panditProfile?.id ?? null,
    employeeActive: record.employeeProfile?.active ?? false,
  };
});

export function viewerCan(viewer: Viewer | null, permission: Permission): boolean {
  return viewer !== null && hasPermission(viewer.permissions, permission);
}

export function viewerCanAny(viewer: Viewer | null, permissions: readonly Permission[]): boolean {
  return viewer !== null && hasAnyPermission(viewer.permissions, permissions);
}

/**
 * Page guard.
 *
 * Renders a 404 rather than a 403 for anonymous visitors and for signed-in
 * people who lack the permission alike, so the existence of an operational area
 * is not confirmed to someone who may not enter it.
 */
export async function requirePermission(permission: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewerCan(viewer, permission)) notFound();
  return viewer as Viewer;
}

/** Page guard for an area reachable through any one of several permissions. */
export async function requireAnyPermission(permissions: readonly Permission[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewerCanAny(viewer, permissions)) notFound();
  return viewer as Viewer;
}

/** Page guard for the genuinely owner-level surfaces: credentials, money rules, staff. */
export async function requireSuperAdminViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) notFound();
  return viewer;
}

export type ActionDenial = { ok: false; error: string };

export const ACTION_DENIED: ActionDenial = {
  ok: false,
  error: "You are not authorised to perform this action.",
};

/**
 * Server Action guard.
 *
 * Returns a denial rather than throwing, so someone submitting a crafted
 * request gets a plain refusal and no stack trace.
 *
 * The rate limit lives here rather than in each action so every current and
 * future staff mutation is covered by construction: an action cannot forget the
 * limiter without also forgetting authorization. The bucket is keyed on the
 * actor's own id, so one operator hammering an endpoint never affects another.
 */
export async function authorizeAction(
  permission: Permission,
  namespace: RateLimitNamespace = "staff:mutation",
): Promise<{ ok: true; viewer: Viewer } | ActionDenial> {
  const viewer = await getViewer();
  if (!viewerCan(viewer, permission)) return ACTION_DENIED;

  const decision = await checkRateLimit({
    namespace,
    identifier: `user:${viewer!.id}`,
  });

  if (!decision.allowed) {
    return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds) };
  }

  return { ok: true, viewer: viewer as Viewer };
}

/**
 * Server Action guard for owner-level mutations.
 *
 * Mirrors `authorizeAction`, including the rate limit, but insists on
 * SUPER_ADMIN rather than on a permission. Used where the point of the control
 * is that it cannot be delegated: credentials, commission, payout rules and
 * staff permissions themselves.
 */
export async function authorizeSuperAdmin(
  namespace: RateLimitNamespace = "staff:owner",
): Promise<{ ok: true; viewer: Viewer } | ActionDenial> {
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) return ACTION_DENIED;

  const decision = await checkRateLimit({ namespace, identifier: `user:${viewer.id}` });
  if (!decision.allowed) {
    return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds) };
  }

  return { ok: true, viewer };
}

/**
 * True when this viewer may reach any staff dashboard at all.
 *
 * Used to decide whether to offer operator navigation, not to decide access.
 */
export function isStaff(viewer: Viewer | null): boolean {
  if (!viewer) return false;
  if (viewer.permissions.has(FULL_ACCESS)) return true;
  return viewer.permissions.size > 0;
}
