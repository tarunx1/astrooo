import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatMoneyMinor } from "@/lib/reports/catalog";
import type { AccountReportSummary } from "@/lib/reports/orders";

function formatDate(value: Date | null): string {
  if (!value) return "Not paid";
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AccountReportList({ reports }: { reports: AccountReportSummary[] }) {
  return (
    <ul className="grid gap-3">
      {reports.map((report) => (
        <li key={report.id}>
          <Card className="p-5" variant="interactive">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="heading-sm">{report.reportName}</h3>
                  <Badge>{report.status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-2 body-sm text-foreground-secondary">{report.profileName}</p>
                <p className="mt-1 caption text-foreground-muted">
                  {formatMoneyMinor(report.amountMinor, report.currency)} · Paid {formatDate(report.paidAt)}
                </p>
              </div>
              <Link
                className="min-h-9 shrink-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                href={`/reports/${report.reportSlug}`}
                prefetch={false}
              >
                View details
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
