import type { Metadata } from "next";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { DataTable, Pagination, SearchBar } from "@/components/dashboard/dashboard-shell";
import { requirePermission } from "@/lib/auth/access";
import { listUsers } from "@/lib/admin/catalog-admin";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 25;

/**
 * Customer lookup for support.
 *
 * Read-only by construction: `users.view` carries no write path, and role
 * changes need `users.manage`, which is not delegable. No birth data, tokens or
 * password material is in the select list.
 */
export default async function EmployeeUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requirePermission("users.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listUsers({ page, pageSize: PAGE_SIZE, search });

  return (
    <EmployeeLayout
      currentPath="/employee/users"
      description="Look up a customer to help them. No birth data or credentials are shown."
      eyebrow="Support"
      title="Customers"
    >
      <SearchBar action="/employee/users" defaultValue={search} placeholder="Search by name or email" />

      <DataTable
        caption="Customers"
        columns={[
          { key: "user", label: "Customer" },
          { key: "joined", label: "Joined" },
          { key: "activity", label: "Activity" },
        ]}
        emptyMessage="No customers match that search."
        getKey={(row) => row.id}
        renderCard={(row) => (
          <div className="grid gap-1.5">
            <p className="body-sm font-semibold text-slate-900">{row.name || "Unnamed"}</p>
            <p className="caption text-slate-500">{row.email}</p>
            <p className="caption text-slate-500">
              {row.orderCount} orders · {row.reportOrderCount} reports
            </p>
          </div>
        )}
        renderCell={(row, key) => {
          switch (key) {
            case "user":
              return (
                <span className="grid">
                  <span className="font-semibold text-slate-800">{row.name || "Unnamed"}</span>
                  <span className="caption text-slate-500">{row.email}</span>
                </span>
              );
            case "joined":
              return row.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
            default:
              return `${row.orderCount} orders · ${row.reportOrderCount} reports`;
          }
        }}
        rows={rows}
      />

      <Pagination basePath="/employee/users" page={page} pageSize={PAGE_SIZE} query={{ q: search }} total={total} />
    </EmployeeLayout>
  );
}
