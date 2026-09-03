import type { Metadata } from "next";
import { AdminLayout, AdminPagination, AdminSearch, AdminStatusBadge, AdminTable } from "@/components/admin/admin-shell";
import { RoleForm } from "@/components/admin/role-form";
import { requireAdmin } from "@/lib/auth/admin";
import { listUsers } from "@/lib/admin/catalog-admin";
import { ADMIN_ROLES } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Users" };

const PAGE_SIZE = 25;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listUsers({ page, pageSize: PAGE_SIZE, search });

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/users"
      description="Read and search only. No tokens, password hashes or birth data are shown."
      title="Users"
    >
      <AdminSearch action="/admin/users" defaultValue={search} placeholder="Search by name or email" />

      <AdminTable
        caption="Users"
        columns={[
          { key: "user", label: "User" },
          { key: "joined", label: "Joined" },
          { key: "activity", label: "Activity" },
          { key: "role", label: "Role" },
        ]}
        emptyMessage="No users match that search."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-2">
            <p className="body-sm font-semibold text-foreground">{row.name || "Unnamed"}</p>
            <p className="caption text-foreground-muted">{row.email}</p>
            <p className="caption text-foreground-muted">
              {row.orderCount} orders · {row.reportOrderCount} reports
            </p>
            <RoleForm
              currentRole={row.role}
              isSelf={row.id === admin.id}
              targetUserId={row.id}
            />
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "user":
              return (
                <span className="grid">
                  <span className="font-semibold text-foreground">{row.name || "Unnamed"}</span>
                  <span className="caption text-foreground-muted">{row.email}</span>
                </span>
              );
            case "joined":
              return row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            case "activity":
              return `${row.orderCount} orders · ${row.reportOrderCount} reports`;
            default:
              return (
                <div className="grid gap-2">
                  {ADMIN_ROLES.includes(row.role) ? <AdminStatusBadge label={row.role} tone="info" /> : null}
                  <RoleForm currentRole={row.role} isSelf={row.id === admin.id} targetUserId={row.id} />
                </div>
              );
          }
        }}
        rows={rows}
      />

      <AdminPagination basePath="/admin/users" page={page} pageSize={PAGE_SIZE} query={{ q: search }} total={total} />
    </AdminLayout>
  );
}
