import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { visibleEmployeeGroups } from "@/config/employee-navigation";
import { getViewer } from "@/lib/auth/access";

/**
 * The employee area's view of the shared dashboard shell.
 *
 * Navigation is filtered by the viewer's permissions, so someone given only
 * tickets sees a dashboard with tickets rather than six links that would refuse
 * them. Each route behind these links calls `requirePermission` itself.
 */
export async function EmployeeLayout({
  currentPath,
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  currentPath: string;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  return (
    <DashboardShell
      actions={actions}
      currentPath={currentPath}
      description={description}
      eyebrow={eyebrow}
      groups={visibleEmployeeGroups(viewer)}
      identityLabel={viewer?.name || viewer?.email || "Staff"}
      railLabel="Operations"
      title={title}
    >
      {children}
    </DashboardShell>
  );
}
