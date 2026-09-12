"use client";

import { usePathname } from "next/navigation";

/**
 * Areas that are dashboards, not pages of the public site.
 *
 * The marketing footer does not belong under an operator's table, and it has a
 * second effect that is easy to miss: it adds several hundred pixels below a
 * short dashboard, so scrolling carries you out of the dashboard section and
 * the sticky sidebar - correctly - stops sticking. Every dashboard area must be
 * listed here, or its sidebar appears to slide away.
 */
const DASHBOARD_PREFIXES = ["/account", "/admin", "/employee", "/pandit"];

export function FooterRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideFooter = DASHBOARD_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (hideFooter) return null;

  return children;
}
