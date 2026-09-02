import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoneyMinor, type ReportDefinitionSummary } from "@/lib/reports/catalog";

export function ReportCard({ report }: { report: ReportDefinitionSummary }) {
  return (
    <Card className="h-full p-5" variant="interactive">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md border border-border bg-surface-raised text-primary">
            <FileText aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="heading-sm">{report.name}</h2>
            <p className="mt-2 body-sm text-foreground-secondary">{report.shortDescription}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="body-sm font-semibold text-foreground">{formatMoneyMinor(report.priceMinor, report.currency)}</p>
            <p className="caption text-foreground-muted">{report.estimatedPages} page guide</p>
          </div>
          <Link
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            href={`/reports/${report.slug}`}
            prefetch={false}
          >
            View
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
