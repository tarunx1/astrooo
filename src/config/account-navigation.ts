import { CalendarHeart, LayoutDashboard, Package, ScrollText, Settings, Star, Users } from "lucide-react";

/**
 * Single source of truth for customer account navigation.
 *
 * `status: "planned"` entries are reserved destinations for later phases. They
 * are rendered as disabled affordances rather than dead links so the shell can
 * grow without scattering navigation arrays across components.
 */
export type AccountNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  status: "available" | "planned";
};

export const accountNavigation: readonly AccountNavItem[] = [
  {
    label: "Overview",
    href: "/account",
    icon: LayoutDashboard,
    description: "Your Tarun Astro account at a glance",
    status: "available",
  },
  {
    label: "Birth Profiles",
    href: "/account/birth-profiles",
    icon: Users,
    description: "Saved birth details for you and your family",
    status: "available",
  },
  {
    label: "Saved Kundlis",
    href: "/account/kundlis",
    icon: Star,
    description: "Charts you have saved to your account",
    status: "available",
  },
  {
    label: "Settings",
    href: "/account/settings",
    icon: Settings,
    description: "Profile and account preferences",
    status: "available",
  },
  {
    label: "Orders",
    href: "/account/orders",
    icon: Package,
    description: "Store orders and their delivery status",
    status: "available",
  },
  {
    label: "Reports",
    href: "/account/reports",
    icon: ScrollText,
    description: "Purchased astrology reports",
    status: "available",
  },
  {
    label: "Consultations",
    href: "/account/consultations",
    icon: CalendarHeart,
    description: "Sessions booked with astrologers",
    status: "planned",
  },
] as const;

export const availableAccountNavigation = accountNavigation.filter((item) => item.status === "available");
