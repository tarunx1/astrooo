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
  //
  // Note what is deliberately absent: an operator is not sent away from here.
  // A Super Admin is also a customer - they may have saved charts, birth
  // profiles and orders of their own - and this layout used to redirect them to
  // /admin/super, which locked them out of their own data entirely. Where
  // sign-in *lands* someone is a different question, and `post-login` still
  // answers it.
  await requireUser();

  return <>{children}</>;
}
