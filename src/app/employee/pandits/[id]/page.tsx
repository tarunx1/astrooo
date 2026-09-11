import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmployeeLayout } from "@/components/employee/employee-shell";
import { PanditCaseFile } from "@/components/admin/pandit-case-file";
import { requirePermission, viewerCan } from "@/lib/auth/access";
import { getPanditDetail } from "@/lib/pandit/queries";
import { getSettings } from "@/lib/settings/service";
import { reviewPanditAction, reviewPanditDocumentAction } from "@/app/admin/pandits/actions";

export const metadata: Metadata = { title: "Pandit" };

/**
 * The employee's case file.
 *
 * The commission control is absent - not because this page hides it, but
 * because commission is a Super Admin capability and `setPanditCommissionAction`
 * refuses anyone else. Passing no action here keeps the page honest about what
 * it can do.
 */
export default async function EmployeePanditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("pandits.view");
  const { id } = await params;

  const [detail, settings] = await Promise.all([
    getPanditDetail(id),
    getSettings(["payouts.platformCommissionPercent"]),
  ]);

  if (!detail) notFound();

  return (
    <EmployeeLayout
      currentPath="/employee/pandits"
      description={detail.user.email}
      eyebrow="Pandits"
      title={detail.displayName || detail.user.name || "Pandit"}
    >
      <PanditCaseFile
        can={{
          review: viewerCan(viewer, "pandits.review"),
          verify: viewerCan(viewer, "pandits.verify"),
          approve: viewerCan(viewer, "pandits.approve"),
          suspend: viewerCan(viewer, "pandits.suspend"),
          setCommission: false,
        }}
        detail={detail}
        documentAction={reviewPanditDocumentAction}
        platformCommission={settings["payouts.platformCommissionPercent"]}
        reviewAction={reviewPanditAction}
      />
    </EmployeeLayout>
  );
}
