"use client";

import { useActionState } from "react";
import { CreditCard, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BirthProfileSummary } from "@/lib/account/birth-profiles";
import type { ReportDefinitionSummary } from "@/lib/reports/catalog";
import { createReportCheckoutAction, type ReportCheckoutState } from "@/app/reports/actions";

const INITIAL_STATE: ReportCheckoutState = { formErrors: [], fieldErrors: {} };

function formatBirthDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ReportPurchasePanel({
  report,
  profiles,
  authenticated,
  checkoutEnabled,
  signInHref,
}: {
  report: ReportDefinitionSummary;
  profiles: BirthProfileSummary[];
  authenticated: boolean;
  checkoutEnabled: boolean;
  signInHref: string;
}) {
  const [state, action, pending] = useActionState(createReportCheckoutAction, INITIAL_STATE);

  if (!authenticated) {
    return (
      <Card className="p-5" variant="commerce">
        <div className="grid gap-4">
          <div className="flex items-start gap-3">
            <LockKeyhole aria-hidden="true" className="mt-1 text-primary" size={18} />
            <div>
              <h2 className="heading-sm">Sign in to continue</h2>
              <p className="mt-2 body-sm text-foreground-secondary">
                Report checkout uses your saved birth profile and account email. Free Kundli generation remains open
                without login.
              </p>
            </div>
          </div>
          <Button href={signInHref} variant="secondary">
            Sign in
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5" variant="commerce">
      <form action={action} className="grid gap-5">
        <input name="reportDefinitionId" type="hidden" value={report.id} />

        <div className="flex items-start gap-3">
          <CreditCard aria-hidden="true" className="mt-1 text-primary" size={18} />
          <div>
            <h2 className="heading-sm">Choose a birth profile</h2>
            <p className="mt-2 body-sm text-foreground-secondary">
              The purchased report keeps an immutable snapshot of the Kundli calculation used at checkout.
            </p>
          </div>
        </div>

        {checkoutEnabled ? null : (
          <p className="rounded-md border border-border bg-background p-3 body-sm text-foreground-secondary" role="status">
            Checkout is disabled while report fulfilment is being prepared.
          </p>
        )}

        {profiles.length === 0 ? (
          <div className="grid gap-3 rounded-md border border-border bg-background p-4">
            <p className="body-sm text-foreground-secondary">Add a saved birth profile before starting report checkout.</p>
            <Button href="/account/birth-profiles/new" size="sm" variant="secondary">
              Add birth profile
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <label className="caption font-semibold text-foreground-secondary" htmlFor="birthProfileId">
              Saved birth profile
            </label>
            <select
              className="min-h-11 rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
              id="birthProfileId"
              name="birthProfileId"
              required
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} - {formatBirthDate(profile.dateOfBirth)}
                </option>
              ))}
            </select>
            {state.fieldErrors.birthProfileId?.[0] ? (
              <p className="caption text-danger" id="birthProfileId-error" role="alert">
                {state.fieldErrors.birthProfileId[0]}
              </p>
            ) : null}
          </div>
        )}

        {state.formErrors.length > 0 ? (
          <p className="rounded-md border border-danger/50 bg-background p-3 body-sm text-danger" role="alert">
            {state.formErrors[0]}
          </p>
        ) : null}

        <Button disabled={!checkoutEnabled || profiles.length === 0 || pending} type="submit">
          {pending ? "Starting checkout..." : "Continue to payment"}
        </Button>
      </form>
    </Card>
  );
}
