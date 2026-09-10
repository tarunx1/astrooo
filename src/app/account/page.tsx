import type { Metadata } from "next";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listBirthProfiles } from "@/lib/account/birth-profiles";
import { listSavedKundlis } from "@/lib/account/saved-kundlis";
import { requireUser } from "@/lib/auth/session";
import { StarFieldSource } from "@/components/visuals/star-field-source";
import { toZodiacSign, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";

export const metadata: Metadata = {
  title: "My Account",
};

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");

  // Independent reads issued together rather than sequentially.
  const [profiles, kundlis] = await Promise.all([listBirthProfiles(user.id), listSavedKundlis(user.id)]);

  const firstName = user.name.trim().split(" ")[0] || "there";

  // The visitor's own Moon sign, taken from their most recently saved chart.
  // This is the sidereal Rashi the astrology provider already calculated and
  // stored on an immutable AstrologyCalculation - it is read here, never
  // recomputed, and never derived from the birth date by this page.
  const moonSign = toZodiacSign(kundlis.find((kundli) => kundli.moonSign)?.moonSign);

  return (
    <AccountLayout
      currentPath="/account"
      description="Your saved birth details and charts live here."
      title={`Namaste, ${firstName}`}
    >
      {/* Gathers the shared star field into the visitor's own sign. Renders
          nothing, and releases the sky again when they navigate away. */}
      {moonSign ? <StarFieldSource label={moonSign} source={zodiacShapeFor(moonSign)} /> : null}

      <AccountSection description="A quick summary of what you have saved." title="Overview">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5" variant="glass">
            <p className="body-sm text-foreground-muted">Birth profiles</p>
            <p className="mt-2 font-display text-4xl leading-none">{profiles.length}</p>
            <Button className="mt-4" href="/account/birth-profiles" size="sm" variant="outline">
              Manage profiles
            </Button>
          </Card>
          <Card className="p-5" variant="glass">
            <p className="body-sm text-foreground-muted">Saved Kundlis</p>
            <p className="mt-2 font-display text-4xl leading-none">{kundlis.length}</p>
            <Button className="mt-4" href="/account/kundlis" size="sm" variant="outline">
              View Kundlis
            </Button>
          </Card>
          {moonSign ? (
            <Card className="p-5 sm:col-span-2" variant="glass-premium">
              <p className="body-sm text-foreground-muted">Your Moon sign</p>
              <p className="mt-2 font-display text-4xl leading-none">{moonSign}</p>
              <p className="mt-3 body-sm text-foreground-secondary">
                The stars behind this page are holding your sign. Calculated from your saved birth
                details, not from your date alone.
              </p>
            </Card>
          ) : null}
        </div>
      </AccountSection>

      <AccountSection description="Generate a new chart or add birth details for someone else." title="Next steps">
        <div className="flex flex-wrap gap-3">
          <Button href="/kundli" variant="primary">
            Generate a Kundli
          </Button>
          <Button href="/account/birth-profiles/new" variant="secondary">
            Add birth profile
          </Button>
        </div>
      </AccountSection>
    </AccountLayout>
  );
}
