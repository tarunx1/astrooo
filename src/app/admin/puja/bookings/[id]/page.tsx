import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PanditOnboardingStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { AssignPanditForm, PujaStatusControls } from "@/components/admin/puja-controls";
import { requirePermission } from "@/lib/auth/access";
import { parseSankalp } from "@/lib/puja/bookings";
import { PUJA_STATUS_LABEL, PUJA_STATUS_TONE } from "@/lib/puja/status";
import { PUJA_MODE_LABEL } from "@/lib/puja/catalog";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import { prisma } from "@/lib/db/prisma";
import { assignPujaPanditAction, transitionPujaBookingAction } from "@/app/admin/puja/actions";

export const metadata: Metadata = { title: "Puja booking" };

/**
 * One puja booking, for an operator.
 *
 * The Sankalp is shown here because an operator scheduling and assigning the
 * ritual needs to know whose name it is performed in - but it is read from an
 * explicit select on this page alone, never from the queue listing, and it is
 * never written to the audit log.
 */
export default async function AdminPujaBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("services.manage");
  const { id } = await params;

  const [booking, pandits] = await Promise.all([
    prisma.pujaBooking.findUnique({
      where: { id },
      select: {
        id: true,
        bookingNumber: true,
        titleSnapshot: true,
        status: true,
        mode: true,
        requestedDate: true,
        scheduledAt: true,
        pricePaise: true,
        currency: true,
        paidAt: true,
        panditProfileId: true,
        operatorNote: true,
        cancellationReason: true,
        createdAt: true,
        sankalpJson: true,
        user: { select: { name: true, email: true } },
        pandit: { select: { displayName: true } },
      },
    }),
    prisma.panditProfile.findMany({
      where: { status: PanditOnboardingStatus.ACTIVE },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
      take: 200,
    }),
  ]);

  if (!booking) notFound();

  const sankalp = parseSankalp(booking.sankalpJson);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/puja/bookings"
      description={`${booking.bookingNumber} · ${booking.user.name || booking.user.email}`}
      title={booking.titleSnapshot}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <DashboardSection title="Booking">
            <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-2">
              <Field label="Reference" value={booking.bookingNumber} />
              <Field label="How it is performed" value={PUJA_MODE_LABEL[booking.mode]} />
              <Field
                label="Requested date"
                value={
                  booking.requestedDate
                    ? booking.requestedDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "No preference given"
                }
              />
              <Field
                label="Scheduled for"
                value={
                  booking.scheduledAt
                    ? booking.scheduledAt.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not scheduled"
                }
              />
              <Field label="Amount" value={formatMoneyMinor(booking.pricePaise, booking.currency)} />
              <Field
                label="Paid"
                value={
                  booking.paidAt
                    ? booking.paidAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                    : "Not paid"
                }
              />
            </dl>

            {booking.cancellationReason ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 body-sm text-slate-700">
                {booking.cancellationReason}
              </p>
            ) : null}
            {booking.operatorNote ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 body-sm text-slate-700">
                Internal note: {booking.operatorNote}
              </p>
            ) : null}
          </DashboardSection>

          <DashboardSection
            description="Private customer data. Shared only with the practitioner assigned to perform the ritual."
            title="Sankalp"
          >
            {sankalp ? (
              <dl className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-2">
                <Field label="Name" value={sankalp.fullName} />
                <Field label="Gotra" value={sankalp.gotra ?? "Not given"} />
                <Field
                  label="Others included"
                  value={sankalp.familyMembers.length > 0 ? sankalp.familyMembers.join(", ") : "None"}
                />
                <Field label="Date of birth" value={sankalp.dateOfBirth ?? "Not given"} />
                <Field label="Place of birth" value={sankalp.birthPlace ?? "Not given"} />
                {sankalp.intention ? <Field label="Intention" value={sankalp.intention} /> : null}
              </dl>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white p-5 body-sm text-slate-500 shadow-xs">
                No Sankalp details were recorded for this booking.
              </p>
            )}
          </DashboardSection>
        </div>

        <div className="grid gap-4 self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <p className="caption font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge
                label={PUJA_STATUS_LABEL[booking.status]}
                tone={PUJA_STATUS_TONE[booking.status]}
              />
            </div>
            <p className="mt-3 caption text-slate-500">
              Booked{" "}
              {booking.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          <DashboardSection title="Practitioner">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <AssignPanditForm
                action={assignPujaPanditAction}
                bookingId={booking.id}
                currentPanditId={booking.panditProfileId}
                pandits={pandits}
              />
            </div>
          </DashboardSection>

          <DashboardSection title="Move this booking on">
            <PujaStatusControls
              action={transitionPujaBookingAction}
              bookingId={booking.id}
              status={booking.status}
            />
          </DashboardSection>
        </div>
      </div>
    </AdminLayout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="caption text-slate-500">{label}</dt>
      <dd className="body-sm text-slate-800">{value}</dd>
    </div>
  );
}
