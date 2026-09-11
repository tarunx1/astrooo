import "server-only";

import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeReturnTo } from "@/lib/auth/return-url";

export const POST_LOGIN_PATH = "/post-login";
export const SUPER_ADMIN_DASHBOARD_PATH = "/admin/super";

export async function resolvePostLoginRedirect(returnTo?: string): Promise<string> {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  const user = await getCurrentUser();

  if (!user) return safeReturnTo;

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (record?.role === UserRole.SUPER_ADMIN) return SUPER_ADMIN_DASHBOARD_PATH;
  if (record?.role === UserRole.ADMIN && (safeReturnTo === "/" || safeReturnTo.startsWith("/account"))) {
    return "/admin";
  }

  return safeReturnTo;
}
