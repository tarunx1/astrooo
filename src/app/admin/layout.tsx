import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";

/** The whole admin area is private and must never be indexed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // Gate for the entire area. Individual pages and every Server Action still
  // authorize independently: this is defence in depth, not the only check.
  await requireAdmin();

  return <>{children}</>;
}
