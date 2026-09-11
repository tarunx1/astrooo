import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getViewer } from "@/lib/auth/access";
import { buildSignInHref } from "@/lib/auth/return-url";

/**
 * The employee area is private and must never be indexed.
 *
 * Reaching the area at all requires holding at least one permission - a
 * deactivated employee resolves to an empty permission set in `getViewer`, so
 * deactivation closes the door here without also needing a role change.
 *
 * Each page inside then requires the specific permission it needs, so an
 * employee given only tickets sees a dashboard with tickets and is refused
 * everywhere else.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function EmployeeRootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect(buildSignInHref("/employee"));

  const isStaffRole =
    viewer.role === UserRole.EMPLOYEE ||
    viewer.role === UserRole.ADMIN ||
    viewer.role === UserRole.SUPER_ADMIN;

  if (!isStaffRole || viewer.permissions.size === 0) notFound();

  return <>{children}</>;
}
