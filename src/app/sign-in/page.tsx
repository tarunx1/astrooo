import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { SignInPanel } from "@/components/account/sign-in-panel";
import { isDevCredentialsEnabled, isGoogleAuthConfigured } from "@/lib/auth/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeReturnTo } from "@/lib/auth/return-url";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;

  // The destination is validated on the server before it is ever handed to the
  // client or to the OAuth callback, so an attacker-supplied absolute URL can
  // never become a redirect target.
  const returnTo = sanitizeReturnTo(raw);

  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <div className="mx-auto w-full max-w-[var(--container-sm)]">
          <h1 className="heading-xl text-center">Sign in to Ravish Astro</h1>
          <p className="mt-3 text-center body-md text-foreground-secondary">
            Save your Kundlis and birth profiles to your account. You can keep generating a free Kundli without an
            account.
          </p>

          <Card className="mt-8 p-6 sm:p-7">
            <SignInPanel
              devCredentialsEnabled={isDevCredentialsEnabled}
              googleEnabled={isGoogleAuthConfigured}
              returnTo={returnTo}
            />
          </Card>

          <p className="mt-6 text-center caption text-foreground-muted">
            We only store what you choose to save. Birth details stay private to your account.
          </p>
        </div>
      </PageContainer>
    </Section>
  );
}
