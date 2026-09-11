import {
  Activity,
  BadgeIndianRupee,
  Boxes,
  CalendarClock,
  ClipboardList,
  Coins,
  FileText,
  Flame,
  Gem,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Plug,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  UserCheck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { DashboardNavGroup, DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import type { Permission } from "@/lib/auth/permissions";
import { viewerCanAny, type Viewer } from "@/lib/auth/access";

/**
 * Super Admin / operations navigation, defined once.
 *
 * Each entry names the permissions that make it relevant. That list controls
 * what an operator *sees*, never what they may do: authorization is enforced
 * server-side on every route and every action, and hiding a link is not a
 * security control. Its real job is to stop an employee with three permissions
 * from being shown eighteen destinations that would all 404.
 */
export type AdminNavItem = DashboardNavItem & {
  /** Shown when the viewer holds any one of these. Omitted means "always". */
  permissions?: readonly Permission[];
  /** Shown only to a SUPER_ADMIN, regardless of permissions. */
  superAdminOnly?: boolean;
};

export type AdminNavGroup = { heading?: string; items: readonly AdminNavItem[] };

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavGroup[] = [
  {
    items: [
      { label: "Super Admin", href: "/admin/super", icon: ShieldCheck, superAdminOnly: true },
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    heading: "Commerce",
    items: [
      { label: "Products", href: "/admin/products", icon: Package, permissions: ["products.view", "products.manage"] },
      { label: "Gemstones", href: "/admin/gemstones", icon: Gem, permissions: ["gemstones.view", "gemstones.manage"] },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes, permissions: ["inventory.manage", "gemstones.inventory"] },
      { label: "Orders", href: "/admin/orders", icon: ClipboardList, permissions: ["orders.view", "orders.manage"] },
      { label: "Coupons", href: "/admin/coupons", icon: Tag, permissions: ["coupons.manage"] },
    ],
  },
  {
    heading: "Astrology services",
    items: [
      { label: "Pandits", href: "/admin/pandits", icon: Sparkles, permissions: ["pandits.view"] },
      { label: "Applications", href: "/admin/pandits/applications", icon: UserCheck, permissions: ["pandits.view"] },
      { label: "Verification queue", href: "/admin/pandits/verification", icon: ShieldCheck, permissions: ["pandits.review", "pandits.verify"] },
      { label: "Consultations", href: "/admin/consultations", icon: CalendarClock, permissions: ["consultations.view"] },
      { label: "Puja bookings", href: "/admin/puja/bookings", icon: Flame, permissions: ["services.manage"] },
    ],
  },
  {
    heading: "Reports",
    items: [
      { label: "Report catalogue", href: "/admin/reports", icon: ScrollText, permissions: ["reports.view", "reports.manage"] },
      { label: "Report orders", href: "/admin/report-orders", icon: FileText, permissions: ["reports.view"] },
      { label: "Generated reports", href: "/admin/generated-reports", icon: FileText, permissions: ["reports.view"] },
    ],
  },
  {
    heading: "Finance",
    items: [
      { label: "Earnings", href: "/admin/earnings", icon: BadgeIndianRupee, permissions: ["payouts.view"] },
      { label: "Payouts", href: "/admin/payouts", icon: Wallet, permissions: ["payouts.view", "payouts.process"] },
      { label: "Commission", href: "/admin/payouts/settings", icon: Coins, superAdminOnly: true },
    ],
  },
  {
    heading: "Platform",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, permissions: ["users.view", "users.manage"] },
      { label: "Employees", href: "/admin/employees", icon: UserCog, permissions: ["employees.view", "employees.manage"] },
      { label: "Tickets", href: "/admin/tickets", icon: LifeBuoy, permissions: ["tickets.view", "tickets.manage"] },
      { label: "Analytics", href: "/admin/analytics", icon: Activity, permissions: ["analytics.view"] },
      { label: "Integrations", href: "/admin/integrations", icon: Plug, superAdminOnly: true },
      { label: "API keys", href: "/admin/api-keys", icon: KeyRound, superAdminOnly: true },
      { label: "Audit log", href: "/admin/audit", icon: ShieldCheck, permissions: ["audit_logs.view"] },
      { label: "Site settings", href: "/admin/settings/site", icon: SlidersHorizontal, superAdminOnly: true },
      { label: "System", href: "/admin/settings", icon: SlidersHorizontal, superAdminOnly: true },
    ],
  },
] as const;

/** Flattened, for callers that want a plain list. */
export const ADMIN_NAVIGATION: readonly AdminNavItem[] = ADMIN_NAVIGATION_GROUPS.flatMap(
  (group) => group.items,
);

/**
 * The groups this viewer should be shown.
 *
 * An entry with no `permissions` and no `superAdminOnly` is shown to anyone who
 * can reach the area at all; a group that ends up empty is dropped rather than
 * rendered as a heading with nothing under it.
 */
export function visibleAdminGroups(viewer: Viewer | null): DashboardNavGroup[] {
  return ADMIN_NAVIGATION_GROUPS.map((group) => ({
    heading: group.heading,
    items: group.items.filter((item) => {
      if (item.superAdminOnly) return viewer?.isSuperAdmin ?? false;
      if (!item.permissions) return true;
      return viewerCanAny(viewer, item.permissions);
    }),
  })).filter((group) => group.items.length > 0);
}
