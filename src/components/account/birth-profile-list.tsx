"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeleteBirthProfileButton } from "@/components/account/delete-birth-profile";
import { viewProfileKundliAction, type AccountFormState } from "@/app/account/actions";
import type { BirthProfileSummary } from "@/lib/account/birth-profiles";

const INITIAL: AccountFormState = { formErrors: [], fieldErrors: {} };

function formatBirthDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * A saved birth profile.
 *
 * Deliberately shows only name, birth date and birth place. Exact birth time and
 * coordinates stay out of the listing; they are private and are not needed here.
 */
export function BirthProfileCard({ profile }: { profile: BirthProfileSummary }) {
  const [state, formAction, pending] = useActionState(viewProfileKundliAction, INITIAL);

  return (
    <Card className="p-5" variant="glass">
      <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
        <div className="min-w-0">
          <h3 className="heading-sm truncate">{profile.name}</h3>
          <dl className="mt-3 grid gap-1.5">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Birth date</dt>
              <CalendarDays aria-hidden="true" className="shrink-0 text-foreground-muted" size={15} />
              <dd className="body-sm text-foreground-secondary">{formatBirthDate(profile.dateOfBirth)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Birth place</dt>
              <MapPin aria-hidden="true" className="shrink-0 text-foreground-muted" size={15} />
              <dd className="body-sm truncate text-foreground-secondary">{profile.placeName}</dd>
            </div>
          </dl>
        </div>

        <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
          <form action={formAction} className="w-full sm:w-auto">
            <input name="profileId" type="hidden" value={profile.id} />
            <button
              className="min-h-9 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan sm:w-auto"
              disabled={pending}
              type="submit"
            >
              {pending ? "Opening..." : "View Kundli"}
            </button>
          </form>
          <Link
            className="min-h-9 rounded-md px-3 py-2 text-xs font-semibold text-foreground-muted transition hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            href={`/account/birth-profiles/${profile.id}/edit`}
            prefetch={false}
          >
            Edit
          </Link>
          <DeleteBirthProfileButton profileId={profile.id} profileName={profile.name} />
        </div>
      </div>

      {state.formErrors.length > 0 ? (
        <p className="mt-3 caption text-danger" role="alert">
          {state.formErrors[0]}
        </p>
      ) : null}
    </Card>
  );
}

export function BirthProfileList({ profiles }: { profiles: BirthProfileSummary[] }) {
  return (
    <ul className="grid gap-3">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <BirthProfileCard profile={profile} />
        </li>
      ))}
    </ul>
  );
}
