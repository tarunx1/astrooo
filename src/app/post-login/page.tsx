import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";

export const metadata: Metadata = {
  title: "Redirecting",
  robots: { index: false, follow: false },
};

/**
 * Post-authentication routing.
 *
 * `mode` is the entrance the person chose on the sign-in card. It is a hint
 * about where they expected to land, never a claim about who they are: the role
 * is re-read from the database here, and every destination authorizes
 * independently.
 */
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; mode?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnTo = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  redirect(await resolvePostLoginRedirect(returnTo, mode));
}
