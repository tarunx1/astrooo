import type { Metadata } from "next";
import { PanditOnboardingStatus, TicketStatus } from "@prisma/client";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { DashboardSection, EmptyState, MetricCard, MetricGrid } from "@/components/dashboard/dashboard-shell";
import { getViewer, viewerCan } from "@/lib/auth/access";
import { describePermissions } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Employee dashboard" };

/**
 * The employee's task list.
 *
 * Deliberately task-oriented rather than analytical: an employee's job is the
 * queue in front of them, and platform-wide revenue is not theirs to see unless
 * a Super Admin explicitly granted `analytics.view`.
 *
 * Every tile is guarded by the permission that would let them act on it, so an
 * employee is never shown a number they cannot open.
 */
export default async function EmployeeDashboardPage() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const canPandits = viewerCan(viewer, "pandits.view");
  const canTickets = viewerCan(viewer, "tickets.view") || viewerCan(viewer, "tickets.manage");
  const canOrders = viewerCan(viewer, "orders.view") || viewerCan(viewer, "orders.manage");
  const canReports = viewerCan(viewer, "reports.view");

  const [applications, inReview, assignedTickets, openTickets, pendingOrders, failedReports] =
    await Promise.all([
      canPandits
        ? prisma.panditProfile.count({ where: { status: PanditOnboardingStatus.SUBMITTED } })
        : Promise.resolve(0),
      canPandits
        ? prisma.panditProfile.count({ where: { status: PanditOnboardingStatus.UNDER_REVIEW } })
        : Promise.resolve(0),
      canTickets
        ? prisma.ticket.count({
            where: {
              assignedToId: viewer.id,
              status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_USER] },
            },
          })
        : Promise.resolve(0),
      canTickets
        ? prisma.ticket.count({ where: { status: TicketStatus.OPEN, assignedToId: null } })
        : Promise.resolve(0),
      canOrders
        ? prisma.order.count({ where: { status: { in: ["PAID", "CONFIRMED", "PROCESSING"] } } })
        : Promise.resolve(0),
      canReports
        ? prisma.generatedReport.count({ where: { status: "FAILED" } })
        : Promise.resolve(0),
    ]);

  const held = describePermissions(viewer.permissions);

  return (
    <EmployeeLayout
      currentPath="/employee"
      description="What is waiting for you today."
      eyebrow="Operations"
      title={`Hello, ${viewer.name || viewer.email}`}
    >
      <MetricGrid>
        {canPandits ? (
          <MetricCard
            href="/employee/pandits"
            label="Applications to review"
            tone={applications > 0 ? "warning" : undefined}
            value={applications}
          />
        ) : null}
        {canPandits ? (
          <MetricCard href="/employee/verification" label="Under review" value={inReview} />
        ) : null}
        {canTickets ? (
          <MetricCard href="/employee/tickets" label="Assigned to you" value={assignedTickets} />
        ) : null}
        {canTickets ? (
          <MetricCard href="/employee/tickets" label="Unassigned tickets" value={openTickets} />
        ) : null}
        {canOrders ? (
          <MetricCard href="/employee/orders" label="Orders to fulfil" value={pendingOrders} />
        ) : null}
        {canReports ? (
          <MetricCard
            href="/employee/reports"
            label="Failed reports"
            tone={failedReports > 0 ? "danger" : undefined}
            value={failedReports}
          />
        ) : null}
      </MetricGrid>

      <DashboardSection
        description="What your Super Admin has given you. Ask them if you need something that is not here."
        title="Your access"
      >
        {held.length === 0 ? (
          <EmptyState
            description="Your account has no operational permissions yet."
            title="Nothing assigned"
          />
        ) : (
          <ul className="grid gap-2 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-2">
            {held.map((permission) => (
              <li className="body-sm text-slate-700" key={permission}>
                <span className="font-mono text-xs text-slate-500">{permission}</span>
                <span className="block caption text-slate-500">{PERMISSIONS[permission]}</span>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </EmployeeLayout>
  );
}
