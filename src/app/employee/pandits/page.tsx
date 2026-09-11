import type { Metadata } from "next";
import { PanditOnboardingStatus } from "@prisma/client";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { PanditList } from "@/app/admin/pandits/pandit-list";
import { requirePermission } from "@/lib/auth/access";
import { listPandits } from "@/lib/pandit/queries";

export const metadata: Metadata = { title: "Pandit applications" };

const PAGE_SIZE = 25;

/**
 * The employee's view of applications.
 *
 * The same listing and the same case file the admin area uses - the difference
 * is only which decisions the viewer's permissions allow, which is decided per
 * action rather than per area.
 */
export default async function EmployeePanditsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requirePermission("pandits.view");
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const search = params.q?.trim() || undefined;
  const status =
    params.status && params.status in PanditOnboardingStatus
      ? (params.status as PanditOnboardingStatus)
      : undefined;

  const { rows, total } = await listPandits({ page, pageSize: PAGE_SIZE, search, status });

  return (
    <EmployeeLayout
      currentPath="/employee/pandits"
      description="Applications and practitioners you can work on."
      eyebrow="Pandits"
      title="Pandit applications"
    >
      <PanditList
        basePath="/employee/pandits"
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        search={search}
        status={status}
        total={total}
      />
    </EmployeeLayout>
  );
}
