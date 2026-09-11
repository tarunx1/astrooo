import type { Metadata } from "next";
import { requirePandit } from "@/lib/pandit/guard";

/**
 * The Pandit area is private and must never be indexed.
 *
 * The gate here is defence in depth: every page and every Server Action inside
 * authorizes independently, and several additionally require approval.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function PanditRootLayout({ children }: { children: React.ReactNode }) {
  await requirePandit();
  return <>{children}</>;
}
