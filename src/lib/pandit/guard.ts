import "server-only";

import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getViewer } from "@/lib/auth/access";
import { buildSignInHref } from "@/lib/auth/return-url";
import { isApprovedOrLater } from "@/lib/pandit/onboarding";
import type { PanditOnboardingStatus } from "@prisma/client";

/**
 * The Pandit area's gate.
 *
 * A Pandit's authority is ownership, not permission: there is no capability to
 * hold that would let one Pandit act on another's account. So the gate resolves
 * the acting person's *own* profile and nothing else, and every query further
 * in is scoped to the id it returns.
 *
 * `requireApprovedPandit` is what keeps the pre-approval dashboard genuinely
 * small. The consultation, earnings and schedule routes call it, so those
 * surfaces are refused before approval rather than merely absent from the
 * navigation - hiding a link has never been the control.
 */
export type PanditIdentity = {
  userId: string;
  name: string;
  email: string;
  profileId: string;
  status: PanditOnboardingStatus;
  displayName: string;
  slug: string | null;
};

export const getPanditIdentity = cache(async (): Promise<PanditIdentity | null> => {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== UserRole.PANDIT || !viewer.panditProfileId) return null;

  const profile = await prisma.panditProfile.findFirst({
    // Scoped by userId as well as id: the profile must belong to the session.
    where: { id: viewer.panditProfileId, userId: viewer.id },
    select: { id: true, status: true, displayName: true, slug: true },
  });

  if (!profile) return null;

  return {
    userId: viewer.id,
    name: viewer.name,
    email: viewer.email,
    profileId: profile.id,
    status: profile.status,
    displayName: profile.displayName,
    slug: profile.slug,
  };
});

/**
 * Page guard for the Pandit area.
 *
 * An anonymous visitor is sent to sign in, because they may well be a Pandit
 * who is simply signed out. Anyone signed in who has no Pandit profile gets a
 * 404 rather than an invitation, so the area's shape is not described to
 * someone who has no business in it.
 */
export async function requirePandit(returnTo = "/pandit"): Promise<PanditIdentity> {
  const viewer = await getViewer();
  if (!viewer) redirect(buildSignInHref(returnTo));

  const identity = await getPanditIdentity();
  if (!identity) notFound();
  return identity;
}

/** Page guard for the surfaces that only exist after approval. */
export async function requireApprovedPandit(returnTo = "/pandit"): Promise<PanditIdentity> {
  const identity = await requirePandit(returnTo);
  if (!isApprovedOrLater(identity.status)) {
    // Not a 404: they are in the right place, just not yet. Sending them to
    // their own onboarding is more useful than pretending the page is missing.
    redirect("/pandit/onboarding");
  }
  return identity;
}
