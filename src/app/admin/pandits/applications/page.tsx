import type { Metadata } from "next";
import { PanditOnboardingStatus } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { PanditList } from "@/app/admin/pandits/pandit-list";
import { requirePermission } from "@/lib/auth/access";
import { listPandits } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Pandit applications" };

const PAGE_SIZE = 25;

/**
 * Newly submitted applications.
 *
 * Ordered oldest-first by `listPandits`, so the person who has waited longest
 * is dealt with first rather than being pushed down by newer arrivals.
 */
export default async function AdminPanditApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const viewer = await requirePermission("pandits.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listPandits({
    page,
    pageSize: PAGE_SIZE,
    search,
    status: PanditOnboardingStatus.SUBMITTED,
  });

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/pandits/applications"
      description="Submitted and waiting for someone to pick them up. Oldest first."
      title="Applications"
    >
      <PanditList
        basePath="/admin/pandits"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        showFilters={false}
        total={total}
      />
    </AdminLayout>
  );
}
