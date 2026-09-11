import type { Metadata } from "next";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { PanditList } from "@/app/admin/pandits/pandit-list";
import { requireAnyPermission } from "@/lib/auth/access";
import { listPandits } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Verification queue" };

const PAGE_SIZE = 25;

export default async function EmployeeVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAnyPermission(["pandits.review", "pandits.verify"]);
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;

  const { rows, total } = await listPandits({ page, pageSize: PAGE_SIZE, search, queueOnly: true });

  return (
    <EmployeeLayout
      currentPath="/employee/verification"
      description="Everything waiting on a reviewer, oldest first."
      eyebrow="Verification"
      title="Verification queue"
    >
      <PanditList
        basePath="/employee/pandits"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        showFilters={false}
        total={total}
      />
    </EmployeeLayout>
  );
}
