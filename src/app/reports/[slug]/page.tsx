import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Section } from "@/components/layout/primitives";
import { ReportPurchasePanel } from "@/components/reports/report-purchase-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <Section className="star-field pb-12 pt-12 lg:pb-14 lg:pt-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <Badge className="border-premium/35 bg-premium/10 text-premium" variant="premium">
            Report
          </Badge>
          <h1 className="mt-4 heading-xl">{report.name}</h1>
          <p className="mt-3 max-w-[58rem] body text-foreground-secondary">{report.description}</p>

          <dl className="mt-5 grid max-w-[960px] gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border/55 bg-surface/60 p-3.5">
              <dt className="caption text-foreground-muted">Price</dt>
              <dd className="mt-0.5 heading-md text-foreground">{formatMoneyMinor(report.priceMinor, report.currency)}</dd>
            </div>
            <div className="rounded-md border border-border/55 bg-surface/60 p-3.5">
              <dt className="caption text-foreground-muted">Length</dt>
              <dd className="mt-0.5 heading-md text-foreground">{report.estimatedPages} pages</dd>
            </div>
            <div className="rounded-md border border-border/55 bg-surface/60 p-3.5">
              <dt className="caption text-foreground-muted">Input</dt>
              <dd className="mt-0.5 heading-md text-foreground">Birth profile</dd>
            </div>
          </dl>

          <div className="mt-5">
            <Button href={user ? "#report-purchase" : signInHref} className="min-h-10 rounded-[12px] px-5 py-2.5 text-sm" size="sm" variant="premium">
              {user ? "Choose birth profile" : "Sign in to purchase"}
            </Button>
          </div>

          <Card className="mt-6 max-w-[960px] border-border/60 bg-surface/58 p-4 shadow-none">
            <h2 className="heading-sm">Included sections</h2>
            <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {report.sectionsIncluded.map((section) => (
                <li key={section} className="flex items-start gap-2 body-sm text-foreground-secondary">
                  <CheckCircle2 aria-hidden="true" className="mt-1 shrink-0 text-premium/80" size={14} strokeWidth={2} />
                  <span>{section}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div id="report-purchase">
          <ReportPurchasePanel
            authenticated={Boolean(user)}
            checkoutEnabled={isReportCheckoutEnabled()}
            profiles={profiles}
            report={report}
            signInHref={signInHref}
          />
        </div>
      </div>
    </Section>
  );
}
