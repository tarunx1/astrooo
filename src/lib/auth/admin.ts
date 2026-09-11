import "server-only";

import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { getViewer, viewerCanAny, type Viewer } from "@/lib/auth/access";
import { ROLE_DEFAULT_PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { checkRateLimit, rateLimitMessage } from "@/lib/security/rate-limit";

/**
 * The admin area's view of the authorization gate.
 *
 * This is no longer a second authorization system. It is a thin projection of
 * the one in `access.ts`, kept because the existing admin pages and actions are
 * written against this shape: the decision underneath is made by permission,
 * and `getViewer` is the only place a role or an override is read.
 *
 * "Being an admin" is defined here as holding any permission an ADMIN holds by
 * default. That keeps a Super Admin, an ADMIN, and an employee who has been
 * given operational permissions all able to reach the operations dashboard,
 * while every individual page and action still checks the specific permission
 * it needs.
 */
export const ADMIN_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

/** The permissions that, held in any combination, make the admin area relevant. */
const ADMIN_AREA_PERMISSIONS = ROLE_DEFAULT_PERMISSIONS[UserRole.ADMIN] as readonly Permission[];

export type AdminIdentity = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isSuperAdmin: boolean;
  permissions: ReadonlySet<Permission>;
};

function project(viewer: Viewer): AdminIdentity {
  return {
    id: viewer.id,
    name: viewer.name,
    email: viewer.email,
    role: viewer.role,
    isSuperAdmin: viewer.isSuperAdmin,
    permissions: viewer.permissions,
  };
}

/**
 * Resolves the acting operator, or null.
 *
 * The role and overrides are re-read from the database on every request rather
 * than trusted from the session payload, so access revoked mid-session takes
 * effect on the next request.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const viewer = await getViewer();
  if (!viewer || !viewerCanAny(viewer, ADMIN_AREA_PERMISSIONS)) return null;
  return project(viewer);
}

/**
 * Page guard.
 *
 * Renders a 404 rather than a 403 for anonymous visitors and signed-in
 * non-operators alike, so the existence of the admin area is not confirmed to
 * someone who may not access it.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) notFound();
  return admin;
}

export type AdminActionDenial = { ok: false; error: string };

export const ADMIN_DENIED: AdminActionDenial = {
  ok: false,
  error: "You are not authorised to perform this action.",
};

/**
 * Server Action guard.
 *
 * Actions return a denial rather than throwing, so a non-operator submitting a
 * crafted request gets a plain refusal and no stack trace.
 *
 * Rate limiting lives here rather than in each action so every current and
 * future admin mutation is covered by construction: an action cannot forget the
 * limiter without also forgetting authorization. The bucket is keyed on the
 * operator's own id, so one person hammering an endpoint never affects another.
 *
 * `permission` narrows the gate to the specific capability the action needs.
 * It is optional only so that pre-existing call sites keep compiling; every
 * action in this codebase passes one.
 */
export async function authorizeAdminAction(
  permission?: Permission,
): Promise<{ ok: true; admin: AdminIdentity } | AdminActionDenial> {
  const viewer = await getViewer();

  const allowed = permission
    ? viewerCanAny(viewer, [permission])
    : viewerCanAny(viewer, ADMIN_AREA_PERMISSIONS);

  if (!allowed) return ADMIN_DENIED;

  const decision = await checkRateLimit({
    namespace: "admin:mutation",
    identifier: `admin:${viewer!.id}`,
  });

  if (!decision.allowed) {
    return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds) };
  }

  return { ok: true, admin: project(viewer as Viewer) };
}

/**
 * Page guard for the system settings area.
 *
 * Settings can change how money is taken and which credentials the server
 * uses, so they are held to a higher bar than day-to-day operations: an
 * operator who can process orders still cannot reach them. Renders a 404 for
 * the same reason `requireAdmin` does - the existence of the area is not
 * confirmed to someone who may not enter it.
 */
export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) notFound();
  return project(viewer);
}

/**
 * Server Action guard for system settings.
 *
 * Mirrors `authorizeAdminAction`, including the rate limit, but requires
 * SUPER_ADMIN. Hiding the navigation is not authorization; every settings
 * mutation calls this.
 */
export async function authorizeSuperAdminAction(): Promise<
  { ok: true; admin: AdminIdentity } | AdminActionDenial
> {
  const viewer = await getViewer();
  if (!viewer?.isSuperAdmin) return ADMIN_DENIED;

  const decision = await checkRateLimit({
    namespace: "admin:settings",
    identifier: `admin:${viewer.id}`,
  });

  if (!decision.allowed) {
    return { ok: false, error: rateLimitMessage(decision.retryAfterSeconds) };
  }

  return { ok: true, admin: project(viewer) };
}
