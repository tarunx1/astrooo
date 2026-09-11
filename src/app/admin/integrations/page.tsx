import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DataTable, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { requireSuperAdminViewer } from "@/lib/auth/access";
import { describeIntegrations } from "@/lib/settings/integrations";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

/**
 * What this platform talks to, and whether it is wired up.
 *
 * Deliberately honest about the difference between "not configured" and "not
 * implemented": an operator seeing a blank key field for a provider that has no
 * client behind it would go looking for a problem that is not theirs to solve.
 */
export default async function AdminIntegrationsPage() {
  const viewer = await requireSuperAdminViewer();
  const integrations = await describeIntegrations();

  return (
    <AdminLayout
      actions={
        <Link
          className="min-h-10 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          href="/admin/api-keys"
        >
          Manage credentials
        </Link>
      }
      adminName={viewer.name || viewer.email}
      currentPath="/admin/integrations"
      description="Third-party services this platform uses, and where each one's credentials come from."
      title="Integrations"
    >
      <DataTable
        caption="Integrations"
        columns={[
          { key: "service", label: "Service" },
          { key: "state", label: "State" },
          { key: "source", label: "Credentials from" },
        ]}
        emptyMessage="No integrations declared."
        getKey={(row) => row.definition.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-slate-900">{row.definition.label}</p>
            <p className="caption text-slate-500">{row.definition.description}</p>
            <StatusBadge
              label={
                row.definition.builtIn
                  ? "Built in"
                  : row.definition.notImplemented
                    ? "Not implemented"
                    : row.configured
                      ? "Configured"
                      : "Not configured"
              }
              tone={
                row.definition.builtIn || row.configured
                  ? "positive"
                  : row.definition.notImplemented
                    ? "neutral"
                    : "warning"
              }
            />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "service":
              return (
                <span className="grid">
                  <span className="font-semibold text-slate-800">{row.definition.label}</span>
                  <span className="caption text-slate-500">{row.definition.description}</span>
                </span>
              );
            case "state":
              return (
                <StatusBadge
                  label={
                    row.definition.builtIn
                      ? "Built in"
                      : row.definition.notImplemented
                        ? "Not implemented"
                        : row.configured
                          ? "Configured"
                          : "Not configured"
                  }
                  tone={
                    row.definition.builtIn || row.configured
                      ? "positive"
                      : row.definition.notImplemented
                        ? "neutral"
                        : "warning"
                  }
                />
              );
            default:
              if (row.definition.builtIn) return "Nothing to configure";
              if (row.secrets.length === 0) return "—";
              return [...new Set(row.secrets.map((secret) => secret.source))].join(", ");
          }
        }}
        rows={integrations}
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="caption text-slate-600">
          Server secrets never reach a browser. Where a client needs to talk to a provider directly - a
          calling session, for example - the server mints a short-lived, scoped token; the app secret stays
          here.
        </p>
      </div>
    </AdminLayout>
  );
}
