import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listSavedKundlis } from "@/lib/account/saved-kundlis";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "My Kundlis",
};

function formatDate(value: Date | null): string {
  if (!value) return "Not recorded";
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SavedKundlisPage() {
  const user = await requireUser("/account/kundlis");
  const kundlis = await listSavedKundlis(user.id);

  return (
    <AccountLayout
      currentPath="/account/kundlis"
      description="Charts you have saved to your account."
      title="Saved Kundlis"
    >
      <AccountSection
        action={
          <Button href="/kundli" size="sm" variant="secondary">
            Generate a Kundli
          </Button>
        }
        description={kundlis.length === 1 ? "1 saved chart" : `${kundlis.length} saved charts`}
        title="Your charts"
      >
        {kundlis.length === 0 ? (
          <EmptyState
            message="Generate a Kundli and choose Save to keep it here."
            title="No saved Kundlis yet"
          />
        ) : (
          <ul className="grid gap-3">
            {kundlis.map((kundli) => (
              <li key={kundli.id}>
                <Card className="p-5" variant="glass">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="heading-sm truncate">{kundli.profileName}</h3>
                      <p className="mt-1 body-sm truncate text-foreground-secondary">{kundli.placeName}</p>
                      <p className="mt-1 caption text-foreground-muted">
                        Calculated {formatDate(kundli.calculatedAt)}
                      </p>

                      {kundli.lagna || kundli.moonSign || kundli.nakshatra ? (
                        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                          {kundli.lagna ? (
                            <div>
                              <dt className="caption text-foreground-muted">Lagna</dt>
                              <dd className="body-sm text-foreground">{kundli.lagna}</dd>
                            </div>
                          ) : null}
                          {kundli.moonSign ? (
                            <div>
                              <dt className="caption text-foreground-muted">Moon Sign</dt>
                              <dd className="body-sm text-foreground">{kundli.moonSign}</dd>
                            </div>
                          ) : null}
                          {kundli.nakshatra ? (
                            <div>
                              <dt className="caption text-foreground-muted">Nakshatra</dt>
                              <dd className="body-sm text-foreground">{kundli.nakshatra}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </div>

                    <Link
                      className="min-h-9 shrink-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                      href={`/kundli/result/${kundli.calculationId}`}
                      prefetch={false}
                    >
                      View Kundli
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </AccountSection>
    </AccountLayout>
  );
}
