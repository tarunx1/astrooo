import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { PanditList } from "@/app/admin/pandits/pandit-list";
import { requireAnyPermission } from "@/lib/auth/access";
import { listPandits } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Verification queue" };

const PAGE_SIZE = 25;

/**
 * Everything a reviewer currently has open.
 *
 * Reachable with either `pandits.review` or `pandits.verify`: an employee who
 * can only request corrections still needs to see what is in the queue.
 */
export default async function AdminVerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const viewer = await requireAnyPermission(["pandits.review", "pandits.verify"]);
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listPandits({ page, pageSize: PAGE_SIZE, search, queueOnly: true });

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/pandits/verification"
      description="Submitted, under review, awaiting corrections, or verified and waiting for approval."
      title="Verification queue"
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
