import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminLayout } from "@/components/admin/admin-shell";
import { PanditCaseFile } from "@/components/admin/pandit-case-file";
import { requirePermission, viewerCan } from "@/lib/auth/access";
import { getPanditDetail } from "@/lib/pandit/queries";
import { getSettings } from "@/lib/settings/service";
import {
  reviewPanditAction,
  reviewPanditDocumentAction,
  setPanditCommissionAction,
} from "@/app/admin/pandits/actions";

export const metadata: Metadata = { title: "Pandit" };

/**
 * One application's case file.
 *
 * Which decisions are offered is derived from the viewer's permissions here,
 * and re-derived by each action on submit - so a page left open after someone's
 * access changed cannot be used to act on that stale authority.
 */
export default async function AdminPanditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePermission("pandits.view");
  const { id } = await params;

  const [detail, settings] = await Promise.all([
    getPanditDetail(id),
    getSettings(["payouts.platformCommissionPercent"]),
  ]);

  if (!detail) notFound();

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/pandits"
      description={detail.user.email}
      title={detail.displayName || detail.user.name || "Pandit"}
    >
      <PanditCaseFile
        can={{
          review: viewerCan(viewer, "pandits.review"),
          verify: viewerCan(viewer, "pandits.verify"),
          approve: viewerCan(viewer, "pandits.approve"),
          suspend: viewerCan(viewer, "pandits.suspend"),
          setCommission: viewer.isSuperAdmin,
        }}
        commissionAction={setPanditCommissionAction}
        detail={detail}
        documentAction={reviewPanditDocumentAction}
        platformCommission={settings["payouts.platformCommissionPercent"]}
        reviewAction={reviewPanditAction}
      />
    </AdminLayout>
  );
}
