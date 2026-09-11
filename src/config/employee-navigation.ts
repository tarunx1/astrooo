import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import type { DashboardNavGroup, DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import type { Permission } from "@/lib/auth/permissions";
import { viewerCanAny, type Viewer } from "@/lib/auth/access";

/**
 * Employee navigation.
 *
 * Every destination except the overview is permission-gated, so an employee
 * whose Super Admin gave them tickets and nothing else sees a dashboard with
 * tickets and nothing else - rather than six links that would all refuse them.
 *
 * This is presentation. The routes behind these links each call
 * `requirePermission` themselves, and hiding a link has never been the control.
 */
export type EmployeeNavItem = DashboardNavItem & { permissions?: readonly Permission[] };

export const EMPLOYEE_NAVIGATION: readonly EmployeeNavItem[] = [
  { label: "Dashboard", href: "/employee", icon: LayoutDashboard },
  {
    label: "Pandit applications",
    href: "/employee/pandits",
    icon: UserCheck,
    permissions: ["pandits.view"],
  },
  {
    label: "Verification queue",
    href: "/employee/verification",
    icon: ShieldCheck,
    permissions: ["pandits.review", "pandits.verify"],
  },
  { label: "Tickets", href: "/employee/tickets", icon: LifeBuoy, permissions: ["tickets.view", "tickets.manage"] },
  { label: "Orders", href: "/employee/orders", icon: ClipboardList, permissions: ["orders.view", "orders.manage"] },
  { label: "Reports", href: "/employee/reports", icon: FileText, permissions: ["reports.view", "reports.manage"] },
  { label: "Customers", href: "/employee/users", icon: Users, permissions: ["users.view"] },
] as const;

export function visibleEmployeeGroups(viewer: Viewer | null): DashboardNavGroup[] {
  const items = EMPLOYEE_NAVIGATION.filter(
    (item) => !item.permissions || viewerCanAny(viewer, item.permissions),
  );

  return items.length > 0 ? [{ items }] : [];
}
