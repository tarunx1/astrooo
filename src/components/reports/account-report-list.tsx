import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatMoneyMinor } from "@/lib/reports/catalog";
import type { AccountReportSummary } from "@/lib/reports/orders";

function formatDate(value: Date | null): string {
  if (!value) return "Not paid";
  return value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Turns the order + generation state into one honest line for the customer.
 *
 * "Processing" covers every intermediate stage: a customer does not need to know
 * whether we are interpreting or rendering, only that it is under way.
 */
function deliveryState(report: AccountReportSummary): { label: string; tone: "ready" | "working" | "failed" | "idle"; detail: string } {
  if (report.hasFailed) {
    return {
      label: "Needs attention",
      tone: "failed",
      detail: "This report could not be completed. Our team has been notified and you have not been charged again.",
    };
  }

  if (report.isDownloadable) {
    return {
      label: "Ready",
      tone: "ready",
      detail: report.pageCount ? `${report.pageCount} pages · Ready ${formatDate(report.readyAt)}` : `Ready ${formatDate(report.readyAt)}`,
    };
  }

  switch (report.status) {
    case "PENDING_PAYMENT":
      return { label: "Awaiting payment", tone: "idle", detail: "Complete checkout to start this report." };
    case "PAID":
    case "QUEUED":
      return { label: "Processing", tone: "working", detail: "Queued for preparation. This usually takes a few minutes." };
    case "CALCULATING":
    case "INTERPRETING":
      return { label: "Processing", tone: "working", detail: "Interpreting your chart." };
    case "RENDERING":
      return { label: "Processing", tone: "working", detail: "Preparing your PDF." };
    case "CANCELLED":
      return { label: "Cancelled", tone: "idle", detail: "This order was cancelled." };
    case "REFUNDED":
      return { label: "Refunded", tone: "idle", detail: "This order was refunded." };
    default:
      return { label: "Processing", tone: "working", detail: "In progress." };
  }
}

const TONE_CLASS: Record<string, string> = {
  ready: "border-premium/50 text-premium",
  working: "border-border-strong text-foreground-secondary",
  failed: "border-danger/50 text-danger",
  idle: "border-border text-foreground-muted",
};

export function AccountReportList({ reports }: { reports: AccountReportSummary[] }) {
  return (
    <ul className="grid gap-3">
      {reports.map((report) => {
        const state = deliveryState(report);

        return (
          <li key={report.id}>
            <Card className="p-5" variant="interactive">
              <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="heading-sm">{report.reportName}</h3>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TONE_CLASS[state.tone]}`}
                    >
                      {state.label}
                    </span>
                  </div>
                  <p className="mt-2 body-sm truncate text-foreground-secondary">{report.profileName}</p>
                  <p className="mt-1 caption text-foreground-muted">{state.detail}</p>
                  <p className="mt-1 caption text-foreground-muted">
                    {formatMoneyMinor(report.amountMinor, report.currency)} · Paid {formatDate(report.paidAt)}
                  </p>
                </div>

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  {report.isDownloadable ? (
                    <a
                      className="min-h-9 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                      href={`/api/reports/${report.id}/download`}
                    >
                      Download PDF
                    </a>
                  ) : null}
                  <Link
                    className="min-h-9 shrink-0 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                    href={`/reports/${report.reportSlug}`}
                    prefetch={false}
                  >
                    View details
                  </Link>
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
