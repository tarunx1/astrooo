import { ADMIN_NAVIGATION_GROUPS, visibleAdminGroups } from "@/config/admin-navigation";
import {
  DashboardHeader,
  DashboardMobileNav,
  DashboardSection,
  DashboardShell,
  DashboardSidebar,
  DataTable,
  Pagination,
  SearchBar,
  StatusBadge,
  type DashboardNavGroup,
  type StatusTone,
} from "@/components/dashboard/dashboard-shell";
import { getViewer } from "@/lib/auth/access";

/**
 * The admin area's view of the shared dashboard shell.
 *
 * There is one shell implementation, in `components/dashboard`. This file is
 * the admin's navigation plus the names the existing admin pages already import,
 * so generalising the shell did not mean rewriting twenty pages to prove it.
 *
 * Navigation is filtered by permission, which is presentation: every route and
 * every action authorizes server-side, so hiding a link changes what an
 * operator sees and nothing about what they may reach.
 */
export async function AdminLayout({
  currentPath,
  title,
  description,
  actions,
  children,
  adminName,
  contentMode,
}: {
  currentPath: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  adminName: string;
  contentMode?: "standard" | "workspace";
}) {
  const viewer = await getViewer();
  const groups = visibleAdminGroups(viewer);

  return (
    <DashboardShell
      actions={actions}
      contentMode={contentMode}
      currentPath={currentPath}
      description={description}
      groups={groups}
      identityLabel={adminName}
      railLabel="Operations"
      title={title}
    >
      {children}
    </DashboardShell>
  );
}

export async function AdminSidebar({ currentPath }: { currentPath: string }) {
  const viewer = await getViewer();
  return <DashboardSidebar currentPath={currentPath} groups={visibleAdminGroups(viewer)} />;
}

export async function AdminMobileNav({ currentPath }: { currentPath: string }) {
  const viewer = await getViewer();
  const items = visibleAdminGroups(viewer).flatMap((group: DashboardNavGroup) => group.items);
  return <DashboardMobileNav currentPath={currentPath} items={items} />;
}

export { ADMIN_NAVIGATION_GROUPS };

/* The names the existing admin pages import, mapped onto the shared shell. */
export const AdminHeader = DashboardHeader;
export const AdminSection = DashboardSection;
export const AdminStatusBadge = StatusBadge;
export const AdminTable = DataTable;
export const AdminPagination = Pagination;
export const AdminSearch = SearchBar;

export type AdminStatusTone = StatusTone;
