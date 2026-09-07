import {
  Boxes,
  SlidersHorizontal,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  ScrollText,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";

/**
 * Admin navigation, defined once.
 *
 * Note that this list controls what an operator *sees*, never what they may do.
 * Authorization is enforced server-side on every route and every action; hiding
 * a link is not a security control.
 */
export type AdminNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /**
   * Only shown to a super admin.
   *
   * Presentation only. Every settings route and action authorizes server-side,
   * so hiding the link changes what an operator sees and nothing about what
   * they may do.
   */
  superAdminOnly?: boolean;
};

export const ADMIN_NAVIGATION: readonly AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Inventory", href: "/admin/inventory", icon: Boxes },
  { label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { label: "Report Catalogue", href: "/admin/reports", icon: ScrollText },
  { label: "Report Orders", href: "/admin/report-orders", icon: FileText },
  { label: "Generated Reports", href: "/admin/generated-reports", icon: FileText },
  { label: "Coupons", href: "/admin/coupons", icon: Tag },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Audit Log", href: "/admin/audit", icon: ShieldCheck },
  { label: "System", href: "/admin/settings", icon: SlidersHorizontal, superAdminOnly: true },
] as const;
