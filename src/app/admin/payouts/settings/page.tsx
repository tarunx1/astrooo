import type { Metadata } from "next";
import { AdminLayout } from "@/components/admin/admin-shell";
import { DashboardSection } from "@/components/dashboard/dashboard-shell";
import { PayoutSettingsForm } from "@/components/admin/payout-forms";
import { requireSuperAdminViewer } from "@/lib/auth/access";
import { getSettings } from "@/lib/settings/service";
import { updatePayoutSettingsAction } from "@/app/admin/payouts/actions";

export const metadata: Metadata = { title: "Commission and payout rules" };

/**
 * The money rules.
 *
 * Super Admin only and not delegable: these decide what every practitioner is
 * owed, which is a different kind of authority from processing a payout that
 * has already been calculated.
 */
export default async function PayoutSettingsPage() {
  const viewer = await requireSuperAdminViewer();

  const settings = await getSettings([
    "payouts.cycle",
    "payouts.cycleAnchorDay",
    "payouts.holdingPeriodDays",
    "payouts.minimumPaise",
    "payouts.platformCommissionPercent",
    "payouts.automatic",
  ]);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/payouts/settings"
      description="How often Pandits are paid, how long earnings are held, and what the platform keeps."
      title="Commission and payout rules"
    >
      <DashboardSection title="Rules">
        <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <PayoutSettingsForm
            action={updatePayoutSettingsAction}
            defaults={{
              cycle: settings["payouts.cycle"],
              cycleAnchorDay: String(settings["payouts.cycleAnchorDay"]),
              holdingPeriodDays: String(settings["payouts.holdingPeriodDays"]),
              minimumRupees: (settings["payouts.minimumPaise"] / 100).toFixed(2),
              platformCommissionPercent: String(settings["payouts.platformCommissionPercent"]),
            }}
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Automatic transfers">
        <div className="max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-5">
          <p className="body-sm text-slate-700">
            Off, and not switchable on from here. Turning it on would need a payout provider with a connected-
            account model - Razorpay Route or an equivalent - and that is a business decision with its own
            onboarding and KYC, not a setting.
          </p>
          <p className="mt-3 caption text-slate-600">
            Until then the ledger, eligibility, batching and audit trail are real; the transfer itself is made
            by an operator and recorded against its bank reference.
          </p>
        </div>
      </DashboardSection>
    </AdminLayout>
  );
}
