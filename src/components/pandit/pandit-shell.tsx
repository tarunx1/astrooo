import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { visiblePanditGroups } from "@/config/pandit-navigation";
import type { PanditIdentity } from "@/lib/pandit/guard";

/**
 * The Pandit area's view of the shared dashboard shell.
 *
 * Navigation is derived from onboarding status, so the dashboard grows as the
 * application progresses rather than showing ten destinations that would all
 * redirect. Each route still checks the status itself.
 */
export function PanditLayout({
  identity,
  currentPath,
  title,
  description,
  eyebrow,
  actions,
  children,
}: {
  identity: PanditIdentity;
  currentPath: string;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      actions={actions}
      currentPath={currentPath}
      description={description}
      eyebrow={eyebrow}
      groups={visiblePanditGroups(identity.status)}
      identityLabel={identity.displayName || identity.email}
      railLabel="My practice"
      title={title}
    >
      {children}
    </DashboardShell>
  );
}
