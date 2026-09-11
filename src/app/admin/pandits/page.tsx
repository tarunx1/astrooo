import type { Metadata } from "next";
import { PanditOnboardingStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { MetricCard, MetricGrid } from "@/components/dashboard/dashboard-shell";
import { PanditList } from "@/app/admin/pandits/pandit-list";
import { requirePermission } from "@/lib/auth/access";
import { listPandits, panditStatusCounts } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Pandits" };

const PAGE_SIZE = 25;

/**
 * Every Pandit, at any stage.
 *
 * Requires `pandits.view`, which is in the default employee bundle - reviewing
 * applications is exactly the delegated work the employee role exists for.
 */
export default async function AdminPanditsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const viewer = await requirePermission("pandits.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const status =
    params.status && params.status in PanditOnboardingStatus
      ? (params.status as PanditOnboardingStatus)
      : undefined;

  const [{ rows, total }, counts] = await Promise.all([
    listPandits({ page, pageSize: PAGE_SIZE, search, status }),
    panditStatusCounts(),
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/pandits"
      description="Applications, verification and the practitioners currently listed."
      title="Pandits"
    >
      <MetricGrid>
        <MetricCard
          href="/admin/pandits/applications"
          label="Awaiting review"
          tone={counts.SUBMITTED > 0 ? "warning" : undefined}
          value={counts.SUBMITTED}
        />
        <MetricCard href="/admin/pandits/verification" label="Under review" value={counts.UNDER_REVIEW} />
        <MetricCard label="Verified, awaiting approval" value={counts.VERIFIED} />
        <MetricCard label="Live" value={counts.ACTIVE} />
      </MetricGrid>

      <PanditList
        basePath="/admin/pandits"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        status={status}
        total={total}
      />
    </AdminLayout>
  );
}
