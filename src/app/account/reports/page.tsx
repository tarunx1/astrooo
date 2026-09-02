import type { Metadata } from "next";
import { AccountLayout, AccountSection } from "@/components/account/account-shell";
import { AccountReportList } from "@/components/reports/account-report-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { listAccountReports } from "@/lib/reports/orders";

export const metadata: Metadata = {
  title: "My Reports",
};

export default async function AccountReportsPage() {
  const user = await requireUser("/account/reports");
  const reports = await listAccountReports(user.id);

  return (
    <AccountLayout
      currentPath="/account/reports"
      description="Paid astrology report orders connected to your saved birth profiles."
      title="Reports"
    >
      <AccountSection
        action={
          <Button href="/reports" size="sm" variant="secondary">
            Browse reports
          </Button>
        }
        description={reports.length === 1 ? "1 report order" : `${reports.length} report orders`}
        title="Your report orders"
      >
        {reports.length === 0 ? (
          <EmptyState
            message="Purchased reports will appear here after checkout is enabled and completed."
            title="No report orders yet"
          />
        ) : (
          <AccountReportList reports={reports} />
        )}
      </AccountSection>
    </AccountLayout>
  );
}
