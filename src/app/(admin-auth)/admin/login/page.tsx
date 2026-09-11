import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GlassAuthCard } from "@/components/account/auth-modal";
import { PageContainer, Section } from "@/components/layout/primitives";
import { getAdminIdentity } from "@/lib/auth/admin";
import { SUPER_ADMIN_DASHBOARD_PATH } from "@/lib/auth/post-login";
import { buildPostLoginHref } from "@/lib/auth/return-url";

/**
 * Operator sign-in.
 *
 * Deliberately not a second authentication system: this is the same Better Auth
 * card the public sign-in page uses, with the destination set to the admin
 * area. There is no separate admin credential store, no parallel session and no
 * second role check - the role is read from the database on the session's user
 * id after sign-in, exactly as everywhere else.
 *
 * It lives in a route group so it is *not* inside the `/admin` layout. That
 * layout requires an admin, so an operator who is not signed in yet would be
 * refused before they could reach the form.
 */
export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default async function AdminLoginPage() {
  // Already an operator: there is nothing to do here.
  const admin = await getAdminIdentity();
  if (admin) redirect(admin.isSuperAdmin ? SUPER_ADMIN_DASHBOARD_PATH : "/admin");

  return (
    <Section className="star-field flex min-h-[calc(100vh-var(--header-height)-12rem)] items-center justify-center py-12">
      <PageContainer className="grid justify-center gap-6 px-0">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="heading-lg">Operator sign in</h1>
          <p className="mt-2 body-sm text-foreground-secondary">
            Use your normal account. Administrator access is granted by role, not by a separate password.
          </p>
        </div>

        <GlassAuthCard defaultTab="signin" returnTo={buildPostLoginHref("/admin")} />
      </PageContainer>
    </Section>
  );
}
