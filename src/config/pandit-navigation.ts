import {
  BadgeIndianRupee,
  CalendarClock,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { PanditOnboardingStatus } from "@prisma/client";
import type { DashboardNavGroup, DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { isApprovedOrLater } from "@/lib/pandit/onboarding";

/**
 * Pandit navigation, gated on onboarding state rather than on permission.
 *
 * A Pandit's access is not a platform-wide capability that could be granted to
 * someone else - it is ownership of their own professional account, and how
 * much of it is open depends on how far through onboarding they are. Before
 * approval the dashboard is deliberately small: progress, verification,
 * documents, corrections, support. The consultation toolset is not merely
 * hidden before approval, it is refused by each route.
 */
export type PanditNavItem = DashboardNavItem & {
  /** Shown only once the Pandit has been approved. */
  requiresApproval?: boolean;
};

export const PANDIT_NAVIGATION: readonly PanditNavItem[] = [
  { label: "Dashboard", href: "/pandit", icon: LayoutDashboard },
  { label: "Onboarding", href: "/pandit/onboarding", icon: Sparkles },
  { label: "Verification", href: "/pandit/verification", icon: ShieldCheck },
  { label: "My profile", href: "/pandit/profile", icon: UserRound, requiresApproval: true },
  { label: "Services & rates", href: "/pandit/services", icon: Star, requiresApproval: true },
  { label: "Schedule", href: "/pandit/schedule", icon: CalendarClock, requiresApproval: true },
  { label: "Consultations", href: "/pandit/consultations", icon: CalendarClock, requiresApproval: true },
  { label: "Chats", href: "/pandit/chats", icon: MessageSquare, requiresApproval: true },
  { label: "Clients", href: "/pandit/clients", icon: Users, requiresApproval: true },
  { label: "Kundli", href: "/pandit/kundli", icon: Star, requiresApproval: true },
  { label: "Earnings", href: "/pandit/earnings", icon: BadgeIndianRupee, requiresApproval: true },
  { label: "Payouts", href: "/pandit/payouts", icon: Wallet, requiresApproval: true },
  { label: "Tickets", href: "/pandit/tickets", icon: LifeBuoy },
  { label: "Settings", href: "/pandit/settings", icon: Settings },
] as const;

export function visiblePanditGroups(status: PanditOnboardingStatus): DashboardNavGroup[] {
  const approved = isApprovedOrLater(status);

  const onboarding = PANDIT_NAVIGATION.filter((item) => !item.requiresApproval);
  const professional = PANDIT_NAVIGATION.filter((item) => item.requiresApproval);

  if (!approved) {
    return [{ items: onboarding }];
  }

  return [
    { items: onboarding.filter((item) => item.href !== "/pandit/onboarding") },
    { heading: "Practice", items: professional },
  ];
}
