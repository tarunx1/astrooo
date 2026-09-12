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
      <Card className="max-w-[320px] border-border/60 bg-surface/68 p-4 shadow-none backdrop-blur-xl" variant="commerce">
        <div className="grid gap-3.5">
          <div className="flex items-start gap-3">
            <LockKeyhole aria-hidden="true" className="mt-1 text-premium" size={15} />
            <div>
              <h2 className="heading-sm">Sign in to continue</h2>
              <p className="mt-1.5 body-sm text-foreground-secondary">
                Report checkout uses your saved birth profile and account email. Free Kundli generation remains open
                without login.
              </p>
            </div>
          </div>
          <Button className="min-h-10 rounded-[12px] py-2.5 text-sm shadow-[0_10px_28px_rgb(214_181_109/0.16)]" href={signInHref} size="sm" variant="premium">
            Sign in
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-[320px] border-border/60 bg-surface/68 p-4 shadow-none backdrop-blur-xl" variant="commerce">
      <form action={action} className="grid gap-4">
        <input name="reportDefinitionId" type="hidden" value={report.id} />

        <div className="flex items-start gap-3">
          <CreditCard aria-hidden="true" className="mt-1 text-premium" size={15} />
          <div>
            <h2 className="heading-sm">Choose a birth profile</h2>
            <p className="mt-1.5 body-sm text-foreground-secondary">
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
              className="form-control"
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

        <Button className="min-h-10 rounded-[12px] py-2.5 text-sm" disabled={!checkoutEnabled || profiles.length === 0 || pending} size="sm" type="submit" variant="premium">
          {pending ? "Starting checkout..." : "Continue to payment"}
        </Button>
      </form>
    </Card>
  );
}
