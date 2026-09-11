import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { GlassAuthCard, type AuthMode } from "@/components/account/auth-modal";
import { getCurrentUser } from "@/lib/auth/session";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";
import { buildPostLoginHref, sanitizeReturnTo } from "@/lib/auth/return-url";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

const MODES: readonly AuthMode[] = ["customer", "pandit", "team"];

/**
 * One sign-in page with three entrances.
 *
 * Customers, Pandits and staff all authenticate through the same Better Auth
 * instance against the same user table - there is no second credential store
 * and no parallel session. The entrance only decides where you land and, for a
 * Pandit sign-up, whether an application is opened.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const rawMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  const returnTo = sanitizeReturnTo(raw);
  const mode = MODES.includes(rawMode as AuthMode) ? (rawMode as AuthMode) : "customer";

  const user = await getCurrentUser();
  if (user) redirect(await resolvePostLoginRedirect(returnTo, rawMode));

  return (
    <Section className="star-field flex min-h-[calc(100vh-var(--header-height)-12rem)] items-center justify-center py-12">
      <PageContainer className="flex justify-center px-0">
        <GlassAuthCard
          defaultMode={mode}
          defaultTab="signin"
          headingLevel="h1"
          returnTo={buildPostLoginHref(returnTo)}
        />
      </PageContainer>
    </Section>
  );
}
