import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout } from "@/components/account/account-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { BookingList } from "@/components/consultations/booking-list";
import { requireUser } from "@/lib/auth/session";
import { customerBookingCounts, listCustomerBookings, type BookingScope } from "@/lib/consultations/bookings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My Consultations",
  robots: { index: false, follow: false },
};

const TABS: ReadonlyArray<{ scope: BookingScope; label: string }> = [
  { scope: "upcoming", label: "Upcoming" },
  { scope: "completed", label: "Completed" },
  { scope: "cancelled", label: "Cancelled" },
];

/**
 * The customer's own consultations.
 *
 * Scoped by the session user id inside the query, so there is no shape of
 * request that returns somebody else's booking.
 */
export default async function AccountConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const user = await requireUser("/account/consultations");
  const params = await searchParams;

  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const scope: BookingScope = TABS.some((tab) => tab.scope === raw) ? (raw as BookingScope) : "upcoming";

  const [bookings, counts] = await Promise.all([
    listCustomerBookings({ userId: user.id, scope }),
    customerBookingCounts(user.id),
  ]);

  return (
    <AccountLayout
      currentPath="/account/consultations"
      description="Sessions you have booked with our verified practitioners."
      eyebrow="My account"
      title="Consultations"
    >
      <nav aria-label="Consultation filters">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.scope === scope;
            const count = counts[tab.scope as keyof typeof counts];

            return (
              <li key={tab.scope}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-md border px-4 body-sm font-medium transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    active
                      ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                  href={`/account/consultations?tab=${tab.scope}`}
                >
                  {tab.label}
                  <span className="caption text-slate-400">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-2">
        {bookings.length === 0 ? (
          <div className="grid gap-4">
            <EmptyState
              message={
                scope === "upcoming"
                  ? "You have no upcoming consultations. Browse our verified practitioners to book one."
                  : `You have no ${scope} consultations.`
              }
              title={scope === "upcoming" ? "Nothing booked yet" : "Nothing here"}
            />
            {scope === "upcoming" ? (
              <Link
                className="mx-auto inline-flex min-h-11 items-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                href="/consultations"
              >
                Find a practitioner
              </Link>
            ) : null}
          </div>
        ) : (
          <BookingList bookings={bookings} side="customer" />
        )}
      </div>
    </AccountLayout>
  );
}
