import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { BirthDetailsForm } from "@/components/kundli/birth-details-form";
import { Card } from "@/components/ui/card";
import { updateBirthProfileAction } from "@/app/account/actions";
import { getOwnedBirthProfile } from "@/lib/account/birth-profiles";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Edit Birth Profile",
};

export default async function EditBirthProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/birth-profiles/${id}/edit`);

  // Ownership is enforced in the query: another user's id resolves to null.
  const profile = await getOwnedBirthProfile(user.id, id);
  if (!profile) notFound();

  return (
    <AccountLayout
      currentPath="/account/birth-profiles"
      description="Changing birth date, time or place produces a new calculation. Existing charts are kept unchanged."
      title="Edit Birth Profile"
    >
      <AccountSection description="Update the details and save." title={profile.name}>
        <Card className="p-5 sm:p-6" variant="glass">
          <BirthDetailsForm
            action={updateBirthProfileAction}
            defaults={{
              name: profile.name,
              gender: profile.gender ?? "",
              dateOfBirth: profile.dateOfBirth,
              timeOfBirth: profile.timeOfBirth,
              timeAccuracy: profile.timeAccuracy,
              place: profile.placeId
                ? {
                    placeId: profile.placeId,
                    displayName: profile.placeName,
                    city: profile.city,
                    region: profile.region ?? undefined,
                    country: profile.country,
                  }
                : null,
            }}
            hiddenFields={{ profileId: profile.id }}
            pendingLabel="Saving changes..."
            submitLabel="Save changes"
          />
        </Card>
      </AccountSection>
    </AccountLayout>
  );
}
