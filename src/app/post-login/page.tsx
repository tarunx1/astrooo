import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolvePostLoginRedirect } from "@/lib/auth/post-login";

export const metadata: Metadata = {
  title: "Redirecting",
  robots: { index: false, follow: false },
};

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;

  redirect(await resolvePostLoginRedirect(raw));
}
