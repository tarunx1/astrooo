import type { Metadata } from "next";
import Link from "next/link";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { DashboardSection, EmptyState, MetricCard, MetricGrid } from "@/components/dashboard/dashboard-shell";
import { BookingList } from "@/components/consultations/booking-list";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { listPanditBookings, type BookingScope } from "@/lib/consultations/bookings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Consultations" };

const TABS: ReadonlyArray<{ scope: BookingScope | "today"; label: string }> = [
  { scope: "today", label: "Today" },
  { scope: "upcoming", label: "Upcoming" },
  { scope: "completed", label: "Completed" },
  { scope: "cancelled", label: "Cancelled" },
];

/**
 * The Pandit's own bookings.
 *
 * Scoped through `pandit: { userId }` in the query, so another practitioner's
 * sessions are not something this page has to remember to exclude - they are
 * not in the result set.
 */
export default async function PanditConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const identity = await requireApprovedPandit("/pandit/consultations");
  const params = await searchParams;

  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const scope = TABS.some((tab) => tab.scope === raw)
    ? (raw as BookingScope | "today")
    : "today";

  const [bookings, todayCount, upcomingCount] = await Promise.all([
    listPanditBookings({ panditUserId: identity.userId, scope }),
    listPanditBookings({ panditUserId: identity.userId, scope: "today" }).then((rows) => rows.length),
    listPanditBookings({ panditUserId: identity.userId, scope: "upcoming" }).then((rows) => rows.length),
  ]);

  return (
    <PanditLayout
      currentPath="/pandit/consultations"
      description="Sessions customers have booked with you."
      eyebrow="Consultations"
      identity={identity}
      title="Your consultations"
    >
      <MetricGrid>
        <MetricCard label="Today" value={todayCount} />
        <MetricCard label="Upcoming" value={upcomingCount} />
      </MetricGrid>

      <nav aria-label="Consultation filters">
        <ul className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const active = tab.scope === scope;
            return (
              <li key={tab.scope}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-md border px-4 body-sm font-medium transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    active
                      ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                  href={`/pandit/consultations?tab=${tab.scope}`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <DashboardSection>
        {bookings.length === 0 ? (
          <EmptyState
            description={
              scope === "today"
                ? "Nothing is scheduled for today."
                : `You have no ${scope} consultations.`
            }
            title="Nothing to show"
          />
        ) : (
          <BookingList bookings={bookings} side="pandit" />
        )}
      </DashboardSection>
    </PanditLayout>
  );
}
