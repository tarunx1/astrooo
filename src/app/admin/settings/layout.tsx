import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/auth/admin";

/** Never indexed, like the rest of admin. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  // Gate for the whole settings area. Every page and every action still
  // authorizes independently; this is defence in depth, not the only check.
  await requireSuperAdmin();

  return <>{children}</>;
}
