import type { Metadata } from "next";
import Image from "next/image";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/account/sign-out-button";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Account Settings",
};

export default async function AccountSettingsPage() {
  const user = await requireUser("/account/settings");

  return (
    <AccountLayout
      currentPath="/account/settings"
      description="How you appear across Tarun Astro."
      title="Settings"
    >
      <AccountSection description="Taken from the account you signed in with." title="Profile">
        <Card className="p-5 sm:p-6" variant="glass">
          <div className="flex flex-wrap items-center gap-4">
            {user.image ? (
              <Image
                alt=""
                className="size-14 rounded-full border border-border object-cover"
                height={56}
                src={user.image}
                width={56}
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-14 place-items-center rounded-full border border-border bg-surface-raised font-display text-xl"
              >
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="heading-sm truncate">{user.name || "Unnamed"}</p>
              <p className="body-sm truncate text-foreground-secondary">{user.email}</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
            <div>
              <dt className="caption text-foreground-muted">Display name</dt>
              <dd className="mt-1 body-sm text-foreground">{user.name || "Not set"}</dd>
            </div>
            <div>
              <dt className="caption text-foreground-muted">Email</dt>
              <dd className="mt-1 body-sm truncate text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="caption text-foreground-muted">Phone</dt>
              <dd className="mt-1 body-sm text-foreground-muted">Not yet supported</dd>
            </div>
            <div>
              <dt className="caption text-foreground-muted">Communication preferences</dt>
              <dd className="mt-1 body-sm text-foreground-muted">Coming soon</dd>
            </div>
          </dl>
        </Card>
      </AccountSection>

      <AccountSection description="You can sign back in at any time." title="Session">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5" variant="glass">
          <p className="body-sm text-foreground-secondary">Sign out of this device.</p>
          <SignOutButton />
        </Card>
      </AccountSection>
    </AccountLayout>
  );
}
