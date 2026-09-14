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
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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
        <Alert variant="warning">
          This is your own account. Nobody changes their own permissions or employment status here - the
          actions refuse it.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <DashboardSection
          description="This is their complete set. Unticking removes."
          title="Permissions"
        >
          <Card padding="md" variant="admin">
            {isSelf ? (
              <p className="body-sm text-foreground-secondary">Not editable for your own account.</p>
            ) : (
              <PermissionPicker
                action={setEmployeePermissionsAction}
                assignable={assignablePermissions()}
                effective={employee.effective}
                targetUserId={employee.userId}
              />
            )}
          </Card>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <Card padding="md" variant="admin">
            <p className="caption font-semibold uppercase tracking-wider text-foreground-muted">Status</p>
            <div className="mt-2">
              <StatusBadge
                label={employee.active ? "Active" : "Deactivated"}
                tone={employee.active ? "positive" : "neutral"}
              />
            </div>
            <p className="mt-3 caption text-foreground-muted">
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
          </Card>

          <DashboardSection title="Details">
            <Card padding="md" variant="admin">
              <EmployeeDetailsForm
                action={updateEmployeeAction}
                defaults={{
                  jobTitle: employee.jobTitle ?? "",
                  department: employee.department ?? "",
                }}
                targetUserId={employee.userId}
              />
            </Card>
          </DashboardSection>

          <Card padding="md" variant="admin">
            <p className="caption font-semibold uppercase tracking-wider text-foreground-muted">
              From their role
            </p>
            <ul className="mt-2 grid gap-1">
              {employee.roleDefaults.map((permission) => (
                <li className="caption font-mono text-foreground-muted" key={permission}>
                  {permission}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
