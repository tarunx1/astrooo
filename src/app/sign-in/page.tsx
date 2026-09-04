import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { GlassAuthCard } from "@/components/account/auth-modal";
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

  const returnTo = sanitizeReturnTo(raw);
  const user = await getCurrentUser();
  if (user) redirect(returnTo);

  return (
    <Section className="star-field flex min-h-[calc(100vh-var(--header-height)-12rem)] items-center justify-center py-12">
      <PageContainer className="flex justify-center px-0">
        <GlassAuthCard defaultTab="signin" returnTo={returnTo} />
      </PageContainer>
    </Section>
  );
}
