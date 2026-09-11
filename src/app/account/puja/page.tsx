import type { Metadata } from "next";
import Link from "next/link";
import { AccountLayout } from "@/components/account/account-shell";
import { DataTable, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { listCustomerPujaBookings } from "@/lib/puja/bookings";
import { PUJA_STATUS_LABEL, PUJA_STATUS_TONE } from "@/lib/puja/status";
import { formatMoneyMinor } from "@/lib/shop/pricing";

export const metadata: Metadata = {
  title: "My Pujas",
  robots: { index: false, follow: false },
};

/**
 * The customer's own puja bookings.
 *
 * Scoped by the session user id inside the query. The Sankalp is deliberately
 * not listed here - it is shown on the individual booking, to the customer and
 * the assigned practitioner only.
 */
export default async function AccountPujaPage() {
  const user = await requireUser("/account/puja");
  const bookings = await listCustomerPujaBookings(user.id);

  return (
    <AccountLayout
      currentPath="/account/puja"
      description="Rituals you have booked and where each one stands."
      eyebrow="My account"
      title="Pujas"
    >
      {bookings.length === 0 ? (
        <div className="grid gap-4">
          <EmptyState
            message="You have not booked any pujas yet."
            title="Nothing booked"
          />
          <Link
            className="mx-auto inline-flex min-h-11 items-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            href="/puja"
          >
            Browse pujas
          </Link>
        </div>
      ) : (
        <DataTable
          caption="Puja bookings"
          columns={[
            { key: "puja", label: "Puja" },
            { key: "when", label: "Date" },
            { key: "pandit", label: "Practitioner" },
            { key: "amount", label: "Amount", align: "right" },
            { key: "status", label: "Status" },
          ]}
          emptyMessage="Nothing booked."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <p className="body-sm font-semibold text-slate-900">{row.title}</p>
              <p className="caption font-mono text-slate-400">{row.bookingNumber}</p>
              <StatusBadge label={PUJA_STATUS_LABEL[row.status]} tone={PUJA_STATUS_TONE[row.status]} />
              <p className="caption text-slate-500">{formatMoneyMinor(row.pricePaise, row.currency)}</p>
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "puja":
                return (
                  <span className="grid">
                    <Link className="font-semibold text-blue-700 underline" href={`/puja/${row.pujaSlug}`}>
                      {row.title}
                    </Link>
                    <span className="caption font-mono text-slate-400">{row.bookingNumber}</span>
                  </span>
                );
              case "when":
                return row.scheduledAt
                  ? row.scheduledAt.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : row.requestedDate
                    ? `${row.requestedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (requested)`
                    : "To be confirmed";
              case "pandit":
                return row.panditName ?? "Being assigned";
              case "amount":
                return formatMoneyMinor(row.pricePaise, row.currency);
              default:
                return (
                  <span className="grid gap-1">
                    <StatusBadge label={PUJA_STATUS_LABEL[row.status]} tone={PUJA_STATUS_TONE[row.status]} />
                    {row.cancellationReason ? (
                      <span className="caption text-slate-500">{row.cancellationReason}</span>
                    ) : null}
                  </span>
                );
            }
          }}
          rows={bookings}
        />
      )}
    </AccountLayout>
  );
}
