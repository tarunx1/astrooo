import type { Metadata } from "next";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { BirthDetailsForm } from "@/components/kundli/birth-details-form";
import { Card } from "@/components/ui/card";
import { createBirthProfileAction } from "@/app/account/actions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Add Birth Profile",
};

export default async function NewBirthProfilePage() {
  await requireUser("/account/birth-profiles/new");

  return (
    <AccountLayout
      currentPath="/account/birth-profiles"
      description="The same birth details used for every Tarun Astro calculation."
      title="Add Birth Profile"
    >
      <AccountSection description="Birth time and place decide the chart, so enter them as precisely as you can." title="Birth details">
        <Card className="p-5 sm:p-6" variant="glass">
          <BirthDetailsForm
            action={createBirthProfileAction}
            pendingLabel="Saving birth profile..."
            submitLabel="Save birth profile"
          />
        </Card>
      </AccountSection>
    </AccountLayout>
  );
}
