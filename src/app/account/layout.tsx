import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminIdentity } from "@/lib/auth/admin";
import { SUPER_ADMIN_DASHBOARD_PATH } from "@/lib/auth/post-login";
import { requireUser } from "@/lib/auth/session";

/** Every account route is private customer data and must never be indexed. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function AccountLayoutRoute({ children }: { children: React.ReactNode }) {
  // Server-side gate for the whole account area. Individual pages and actions
  // still authorize their own data access; this only blocks anonymous entry.
  await requireUser();
  const admin = await getAdminIdentity();
  if (admin?.isSuperAdmin) redirect(SUPER_ADMIN_DASHBOARD_PATH);

  return <>{children}</>;
}
