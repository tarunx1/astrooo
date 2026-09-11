import type { Metadata } from "next";
import { DashboardSection, DataTable, EmptyState } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { listSharedCharts } from "@/lib/pandit/kundli-access";

export const metadata: Metadata = { title: "Shared charts" };

/**
 * Charts a client has chosen to share.
 *
 * Deliberately not "search for a customer's Kundli". A Pandit has no standing
 * access to anyone's chart; what appears here was granted by the customer, for
 * a specific consultation, and they can withdraw it.
 */
export default async function PanditKundliPage() {
  const identity = await requireApprovedPandit("/pandit/kundli");
  const charts = await listSharedCharts(identity.profileId);

  return (
    <PanditLayout
      currentPath="/pandit/kundli"
      description="Only charts a client has shared with you for a booked consultation appear here."
      eyebrow="Kundli"
      identity={identity}
      title="Shared charts"
    >
      {charts.length === 0 ? (
        <EmptyState
          description="When a client shares a chart for a consultation, it appears here for as long as they leave it shared."
          title="No charts shared with you"
        />
      ) : (
        <DashboardSection title="Shared with you">
          <DataTable
            caption="Shared charts"
            columns={[
              { key: "chart", label: "Chart" },
              { key: "client", label: "Client" },
              { key: "consultation", label: "Consultation" },
              { key: "viewed", label: "Last opened" },
            ]}
            emptyMessage="No charts shared with you."
            getKey={(row) => row.accessId}
            renderCard={(row) => (
              <div className="grid gap-1.5">
                <p className="body-sm font-semibold text-slate-900">{row.chartName}</p>
                <p className="caption text-slate-500">{row.clientName}</p>
                <p className="caption text-slate-500">
                  {row.consultationAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            )}
            renderCell={(row, key) => {
              switch (key) {
                case "chart":
                  return <span className="font-semibold text-slate-800">{row.chartName}</span>;
                case "client":
                  return row.clientName;
                case "consultation":
                  return row.consultationAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                default:
                  return row.lastViewedAt
                    ? row.lastViewedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : "Not opened";
              }
            }}
            rows={charts}
          />
        </DashboardSection>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="caption text-slate-600">
          Every time you open a shared chart it is recorded, so a client can see who read their birth details
          and when.
        </p>
      </div>
    </PanditLayout>
  );
}
