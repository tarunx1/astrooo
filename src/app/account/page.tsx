import type { Metadata } from "next";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listBirthProfiles } from "@/lib/account/birth-profiles";
import { listSavedKundlis } from "@/lib/account/saved-kundlis";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "My Account",
};

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");

  // Independent reads issued together rather than sequentially.
  const [profiles, kundlis] = await Promise.all([listBirthProfiles(user.id), listSavedKundlis(user.id)]);

  const firstName = user.name.trim().split(" ")[0] || "there";

  return (
    <AccountLayout
      currentPath="/account"
      description="Your saved birth details and charts live here."
      title={`Namaste, ${firstName}`}
    >
      <AccountSection description="A quick summary of what you have saved." title="Overview">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="body-sm text-foreground-muted">Birth profiles</p>
            <p className="mt-2 font-display text-4xl leading-none">{profiles.length}</p>
            <Button className="mt-4" href="/account/birth-profiles" size="sm" variant="outline">
              Manage profiles
            </Button>
          </Card>
          <Card className="p-5">
            <p className="body-sm text-foreground-muted">Saved Kundlis</p>
            <p className="mt-2 font-display text-4xl leading-none">{kundlis.length}</p>
            <Button className="mt-4" href="/account/kundlis" size="sm" variant="outline">
              View Kundlis
            </Button>
          </Card>
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
