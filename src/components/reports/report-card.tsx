import { ArrowRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardFooter } from "@/components/ui/card";
import { PriceDisplay } from "@/components/ui/price-display";
import { formatMoneyMinor, type ReportDefinitionSummary } from "@/lib/reports/catalog";

export function ReportCard({ report }: { report: ReportDefinitionSummary }) {
  return (
    <Card equalHeight padding="md" variant="interactive">
      <CardBody className="gap-5">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-surface-raised text-primary">
            <FileText aria-hidden="true" size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="heading-sm">{report.name}</h2>
            <p className="mt-2 body-sm text-foreground-secondary">{report.shortDescription}</p>
          </div>
        </div>

        <CardFooter className="flex items-center justify-between gap-4 border-t border-border">
          <PriceDisplay
            amount={formatMoneyMinor(report.priceMinor, report.currency)}
            meta={`${report.estimatedPages} page guide`}
            size="sm"
          />
          <Button href={`/reports/${report.slug}`} size="sm" variant="secondary">
            View
            <ArrowRight aria-hidden="true" size={14} />
          </Button>
        </CardFooter>
      </CardBody>
    </Card>
  );
}
