import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, DataTable, Pagination, SearchBar, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { CreateEmployeeForm } from "@/components/admin/employee-forms";
import { requireSuperAdminViewer } from "@/lib/auth/access";
import { listEmployees } from "@/lib/admin/employees";
import { createEmployeeAction } from "@/app/admin/employees/actions";

export const metadata: Metadata = { title: "Employees" };

const PAGE_SIZE = 25;

/**
 * Staff management.
 *
 * Super Admin only, and deliberately so: someone who could re-permission staff
 * could give themselves anything, so the capability is held by the owner and is
 * not in the delegable set.
 */
export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const viewer = await requireSuperAdminViewer();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listEmployees({ page, pageSize: PAGE_SIZE, search });

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/employees"
      description="Who works here and exactly what each of them can do."
      title="Employees"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DashboardSection title="Staff">
          <SearchBar action="/admin/employees" defaultValue={search} placeholder="Search by name or email" />

          <DataTable
            caption="Employees"
            columns={[
              { key: "person", label: "Employee" },
              { key: "role", label: "Role" },
              { key: "permissions", label: "Overrides", align: "right" },
              { key: "tickets", label: "Tickets", align: "right" },
              { key: "status", label: "Status" },
            ]}
            emptyMessage="No staff accounts yet."
            getKey={(row) => row.userId}
            renderCard={(row) => (
              <div className="grid gap-1.5">
                <Link className="body-sm font-semibold text-blue-700 underline" href={`/admin/employees/${row.userId}`}>
                  {row.name || row.email}
                </Link>
                <p className="caption text-slate-500">{row.email}</p>
                <StatusBadge
                  label={row.active ? "Active" : "Deactivated"}
                  tone={row.active ? "positive" : "neutral"}
                />
              </div>
            )}
            renderCell={(row, key) => {
              switch (key) {
                case "person":
                  return (
                    <span className="grid">
                      <Link
                        className="font-semibold text-blue-700 underline"
                        href={`/admin/employees/${row.userId}`}
                      >
                        {row.name || "Unnamed"}
                      </Link>
                      <span className="caption text-slate-500">{row.email}</span>
                    </span>
                  );
                case "role":
                  return [row.jobTitle, row.department].filter(Boolean).join(" · ") || "—";
                case "permissions":
                  return row.permissionCount;
                case "tickets":
                  return row.assignedTicketCount;
                default:
                  return (
                    <StatusBadge
                      label={row.active ? "Active" : "Deactivated"}
                      tone={row.active ? "positive" : "neutral"}
                    />
                  );
              }
            }}
            rows={rows}
          />

          <Pagination
            basePath="/admin/employees"
            page={page}
            pageSize={PAGE_SIZE}
            query={{ q: search }}
            total={total}
          />
        </DashboardSection>

        <DashboardSection title="Add an employee">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <CreateEmployeeForm action={createEmployeeAction} />
          </div>
        </DashboardSection>
      </div>
    </AdminLayout>
  );
}
