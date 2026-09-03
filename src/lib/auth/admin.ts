import "server-only";

import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * The single admin authorization gate.
 *
 * Every admin page and every admin Server Action calls one of these. There is no
 * second path, no email comparison inside a page, and no reliance on hidden
 * navigation: the role is read from the database using the id on the server
 * session, never from anything the browser supplied.
 */
export const ADMIN_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

export type AdminIdentity = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isSuperAdmin: boolean;
};

/**
 * Resolves the acting admin, or null.
 *
 * The role is re-read from the database rather than trusted from the session
 * payload, so a role revoked mid-session takes effect on the next request.
 * Cached per request so a page and its actions share one lookup.
 */
export const getAdminIdentity = cache(async (): Promise<AdminIdentity | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!record || !ADMIN_ROLES.includes(record.role)) return null;

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    isSuperAdmin: record.role === UserRole.SUPER_ADMIN,
  };
});

/**
 * Page guard.
 *
 * Renders a 404 rather than a 403 for anonymous visitors and signed-in
 * non-admins alike, so the existence of the admin area is not confirmed to
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
 * Actions return a denial rather than throwing, so a non-admin submitting a
 * crafted request gets a plain refusal and no stack trace.
 */
export async function authorizeAdminAction(): Promise<
  { ok: true; admin: AdminIdentity } | AdminActionDenial
> {
  const admin = await getAdminIdentity();
  if (!admin) return ADMIN_DENIED;
  return { ok: true, admin };
}
