import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Section } from "@/components/layout/primitives";
import { ReportPurchasePanel } from "@/components/reports/report-purchase-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { listBirthProfiles } from "@/lib/account/birth-profiles";
import { buildSignInHref } from "@/lib/auth/return-url";
import { getCurrentUser } from "@/lib/auth/session";
import { isReportCheckoutEnabled } from "@/lib/payments/config";
import { formatMoneyMinor, getActiveReportDefinitionBySlug } from "@/lib/reports/catalog";

type Params = Promise<{ slug: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const report = await getActiveReportDefinitionBySlug(slug);
  if (!report) return {};

  return {
    title: report.name,
    description: report.shortDescription,
  };
}

export default async function ReportDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [report, user] = await Promise.all([getActiveReportDefinitionBySlug(slug), getCurrentUser()]);
  if (!report) notFound();

  const profiles = user ? await listBirthProfiles(user.id) : [];
  const signInHref = buildSignInHref(`/reports/${report.slug}`);

  return (
    <Section className="star-field">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0">
          <Badge>Report</Badge>
          <h1 className="mt-4 heading-xl">{report.name}</h1>
          <p className="mt-4 body-lg text-foreground-secondary">{report.description}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-4">
              <dt className="caption text-foreground-muted">Price</dt>
              <dd className="mt-1 heading-sm">{formatMoneyMinor(report.priceMinor, report.currency)}</dd>
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <dt className="caption text-foreground-muted">Length</dt>
              <dd className="mt-1 heading-sm">{report.estimatedPages} pages</dd>
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <dt className="caption text-foreground-muted">Input</dt>
              <dd className="mt-1 heading-sm">Birth profile</dd>
            </div>
          </dl>

          <Card className="mt-8 p-5">
            <h2 className="heading-md">Included sections</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {report.sectionsIncluded.map((section) => (
                <li key={section} className="flex items-start gap-2 body-sm text-foreground-secondary">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-primary" size={16} />
                  <span>{section}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <ReportPurchasePanel
          authenticated={Boolean(user)}
          checkoutEnabled={isReportCheckoutEnabled()}
          profiles={profiles}
          report={report}
          signInHref={signInHref}
        />
      </div>
    </Section>
  );
}
