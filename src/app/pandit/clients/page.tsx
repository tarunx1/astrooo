import type { Metadata } from "next";
import { DataTable, EmptyState } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { listPanditClients } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Clients" };

/**
 * People who have booked this Pandit.
 *
 * Derived from consultations, so there is no query shape here that returns a
 * customer who has never booked them. A Pandit never sees the user table.
 */
export default async function PanditClientsPage() {
  const identity = await requireApprovedPandit("/pandit/clients");
  const clients = await listPanditClients(identity.profileId);

  return (
    <PanditLayout
      currentPath="/pandit/clients"
      description="Everyone who has booked a consultation with you."
      eyebrow="Clients"
      identity={identity}
      title="Your clients"
    >
      {clients.length === 0 ? (
        <EmptyState description="Clients appear here once they book you." title="No clients yet" />
      ) : (
        <DataTable
          caption="Clients"
          columns={[
            { key: "name", label: "Client" },
            { key: "count", label: "Consultations", align: "right" },
            { key: "last", label: "Most recent" },
          ]}
          emptyMessage="No clients yet."
          getKey={(row) => row.id}
          renderCard={(row) => (
            <div className="grid gap-1.5">
              <p className="body-sm font-semibold text-slate-900">{row.name || row.email}</p>
              <p className="caption text-slate-500">
                {row.consultationCount} consultation{row.consultationCount === 1 ? "" : "s"}
              </p>
            </div>
          )}
          renderCell={(row, key) => {
            switch (key) {
              case "name":
                return (
                  <span className="grid">
                    <span className="font-semibold text-slate-800">{row.name || "Client"}</span>
                    <span className="caption text-slate-500">{row.email}</span>
                  </span>
                );
              case "count":
                return row.consultationCount;
              default:
                return row.lastAt.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
            }
          }}
          rows={clients}
        />
      )}
    </PanditLayout>
  );
}
