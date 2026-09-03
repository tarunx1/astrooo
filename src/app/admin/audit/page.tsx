import type { Metadata } from "next";
import { AdminLayout, AdminPagination, AdminTable } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";
import { listAuditLog } from "@/lib/admin/audit";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 30;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { entries, total } = await listAuditLog({ page, pageSize: PAGE_SIZE });

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/audit"
      description="Append-only. Entries cannot be edited or removed from this interface."
      title="Audit log"
    >
      <AdminTable
        caption="Audit log"
        columns={[
          { key: "when", label: "When" },
          { key: "who", label: "Who" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "detail", label: "Detail" },
        ]}
        emptyMessage="No recorded actions yet."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1">
            <p className="body-sm font-semibold text-foreground">{row.action.replaceAll("_", " ")}</p>
            <p className="caption text-foreground-muted">
              {row.entityType} · {row.actorEmail}
            </p>
            <p className="caption text-foreground-muted">
              {row.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <p className="caption text-foreground-muted">{JSON.stringify(row.metadata)}</p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "when":
              return row.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            case "who":
              return row.actorEmail;
            case "action":
              return <span className="font-semibold text-foreground">{row.action.replaceAll("_", " ")}</span>;
            case "entity":
              return `${row.entityType} ${row.entityId.slice(0, 8)}`;
            default:
              return <span className="caption text-foreground-muted">{JSON.stringify(row.metadata)}</span>;
          }
        }}
        rows={entries}
      />

      <AdminPagination basePath="/admin/audit" page={page} pageSize={PAGE_SIZE} total={total} />
    </AdminLayout>
  );
}
