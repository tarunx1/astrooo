"use client";

import { usePathname } from "next/navigation";

const DASHBOARD_PREFIXES = ["/account", "/admin"];

export function FooterRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = DASHBOARD_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (hideFooter) return null;

  return children;
}
