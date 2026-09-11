import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import {
  EmployeeDetailsForm,
  EmployeeStatusForm,
  PermissionPicker,
} from "@/components/admin/employee-forms";
import { requireSuperAdminViewer } from "@/lib/auth/access";
import { assignablePermissions, getEmployeeDetail } from "@/lib/admin/employees";
import {
  setEmployeeActiveAction,
  setEmployeePermissionsAction,
  updateEmployeeAction,
} from "@/app/admin/employees/actions";

export const metadata: Metadata = { title: "Employee" };

/**
 * One employee and their exact access.
 *
 * Shows the role default alongside the effective set, so it is visible whether
 * a capability comes from the role or from a deliberate grant - which is the
 * question an owner actually has when reviewing someone's access.
 */
export default async function AdminEmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireSuperAdminViewer();
  const { id } = await params;

  const employee = await getEmployeeDetail(id);
  if (!employee) notFound();

  const isSelf = employee.userId === viewer.id;

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/employees"
      description={employee.email}
      title={employee.name || "Employee"}
    >
      {isSelf ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="body-sm text-slate-800">
            This is your own account. Nobody changes their own permissions or employment status here - the
            actions refuse it.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DashboardSection
          description="This is their complete set. Unticking removes."
          title="Permissions"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            {isSelf ? (
              <p className="body-sm text-slate-600">Not editable for your own account.</p>
            ) : (
              <PermissionPicker
                action={setEmployeePermissionsAction}
                assignable={assignablePermissions()}
                effective={employee.effective}
                targetUserId={employee.userId}
              />
            )}
          </div>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <p className="caption font-semibold uppercase tracking-wider text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge
                label={employee.active ? "Active" : "Deactivated"}
                tone={employee.active ? "positive" : "neutral"}
              />
            </div>
            <p className="mt-3 caption text-slate-500">
              Added{" "}
              {employee.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            {!isSelf ? (
              <div className="mt-4">
                <EmployeeStatusForm
                  action={setEmployeeActiveAction}
                  active={employee.active}
                  targetUserId={employee.userId}
                />
              </div>
            ) : null}
          </div>

          <DashboardSection title="Details">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <EmployeeDetailsForm
                action={updateEmployeeAction}
                defaults={{
                  jobTitle: employee.jobTitle ?? "",
                  department: employee.department ?? "",
                }}
                targetUserId={employee.userId}
              />
            </div>
          </DashboardSection>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <p className="caption font-semibold uppercase tracking-wider text-slate-500">
              From their role
            </p>
            <ul className="mt-2 grid gap-1">
              {employee.roleDefaults.map((permission) => (
                <li className="caption font-mono text-slate-500" key={permission}>
                  {permission}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
