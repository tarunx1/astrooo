import { getViewer, viewerCanAny } from "@/lib/auth/access";
import type { Permission } from "@/lib/auth/permissions";

/**
 * Renders a section only for someone entitled to see it.
 *
 * Reaching an admin page is a coarser question than seeing everything on it.
 * `requireAdmin` admits anyone holding any operations permission - which is
 * right, because an employee given orders needs the order screens - but it
 * means a shared page can carry a section that same employee has no business
 * reading. Revenue on the Overview page was exactly that.
 *
 * This is a real authorization check, not a styling helper: the children are
 * never rendered, so the data does not reach the response at all. Where the
 * data is expensive to fetch, check with `viewerCanAny` *before* fetching
 * rather than wrapping the output - not rendering something you already loaded
 * still loaded it.
 *
 * A page whose *whole* purpose needs a permission should use
 * `requirePermission` at the top instead. This is for the mixed pages.
 */
export async function PermissionGate({
  anyOf,
  children,
  fallback = null,
}: {
  anyOf: readonly Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewerCanAny(viewer, anyOf)) return <>{fallback}</>;

  return <>{children}</>;
}
