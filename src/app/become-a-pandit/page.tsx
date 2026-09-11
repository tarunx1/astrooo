import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { SimpleActionForm } from "@/components/pandit/pandit-forms";
import { getViewer } from "@/lib/auth/access";
import { STATUS_LABEL, ONBOARDING_STEPS } from "@/lib/pandit/onboarding";
import { applyAsPanditAction } from "@/app/pandit/actions";

export const metadata: Metadata = {
  title: "Practise on Tarun Astro",
  description:
    "Apply to offer consultations on Tarun Astro. Verification, your own schedule and rates, and transparent earnings.",
};

/**
 * The Pandit entry point.
 *
 * Deliberately outside the `/pandit` layout, which requires an existing
 * application: this is the page someone reaches *before* they have one, and it
 * is where the sign-in card's Pandit entrance sends a new applicant.
 *
 * Opening an application grants nothing. It sets a role that carries no
 * permissions, and everything that matters - being listed, taking bookings,
 * being paid - is gated on the onboarding status, which only a reviewer can
 * advance.
 */
export default async function BecomeAPanditPage() {
  const viewer = await getViewer();

  // Someone who already has an application belongs in their own dashboard.
  if (viewer?.panditProfileId) redirect("/pandit");

  return (
    <Section className="star-field py-16">
      <PageContainer className="grid gap-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="caption uppercase tracking-[0.2em] text-premium">For practitioners</p>
          <h1 className="mt-3 heading-xl">Practise on Tarun Astro</h1>
          <p className="mt-4 body-md text-foreground-secondary">
            Offer chat, voice and video consultations to people who are already here for their charts. You
            set your own hours and your own rates, within the platform&rsquo;s published range.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <h2 className="heading-sm">Verified, then listed</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              We check identity and experience before anyone appears publicly. That is what makes the listing
              worth being on.
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="heading-sm">Your schedule, your rates</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              Weekly availability with date-specific exceptions, and a rate per consultation type. Nobody is
              booked outside the hours they set.
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="heading-sm">Earnings you can audit</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              Every completed consultation produces a ledger line showing the gross, the platform share and
              what you receive. Payouts are tracked to a bank reference.
            </p>
          </Card>
        </div>

        <Card className="mx-auto w-full max-w-2xl p-6">
          <h2 className="heading-md">How onboarding works</h2>
          <ol className="mt-4 grid gap-2">
            {ONBOARDING_STEPS.map((step, index) => (
              <li className="flex items-center gap-3" key={step}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold text-foreground-muted">
                  {index + 1}
                </span>
                <span className="body-sm text-foreground-secondary">{STATUS_LABEL[step]}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 border-t border-border pt-6">
            {viewer ? (
              <>
                <p className="mb-4 body-sm text-foreground-secondary">
                  Signed in as {viewer.email}. Opening an application starts the process; you can complete it
                  over several sittings.
                </p>
                <SimpleActionForm
                  action={applyAsPanditAction}
                  label="Open my application"
                  pendingLabel="Opening..."
                />
              </>
            ) : (
              <>
                <p className="mb-4 body-sm text-foreground-secondary">
                  Create an account or sign in to start. Use the Pandit entrance on the sign-in card.
                </p>
                <Link
                  className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover"
                  href="/sign-in?returnTo=%2Fbecome-a-pandit&mode=pandit"
                >
                  Sign in to apply
                </Link>
              </>
            )}
          </div>
        </Card>
      </PageContainer>
    </Section>
  );
}
