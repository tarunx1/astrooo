import type { Metadata } from "next";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { BirthProfileList } from "@/components/account/birth-profile-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { listBirthProfiles } from "@/lib/account/birth-profiles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "My Birth Profiles",
};

export default async function BirthProfilesPage() {
  const user = await requireUser("/account/birth-profiles");
  const profiles = await listBirthProfiles(user.id);

  return (
    <AccountLayout
      currentPath="/account/birth-profiles"
      description="Birth details you have saved for yourself and your family."
      title="Birth Profiles"
    >
      <AccountSection
        action={
          <Button href="/account/birth-profiles/new" size="sm" variant="secondary">
            Add birth profile
          </Button>
        }
        description={profiles.length === 1 ? "1 saved profile" : `${profiles.length} saved profiles`}
        title="Saved profiles"
      >
        {profiles.length === 0 ? (
          <EmptyState
            message="Add birth details once and reuse them for Kundlis, matching and reports."
            title="No birth profiles yet"
          />
        ) : (
          <BirthProfileList profiles={profiles} />
        )}
      </AccountSection>
    </AccountLayout>
  );
}
