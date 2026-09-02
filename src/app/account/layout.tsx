import type { Metadata } from "next";
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

  return <>{children}</>;
}
