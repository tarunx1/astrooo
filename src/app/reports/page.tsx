import type { Metadata } from "next";
import { Section, SectionHeader } from "@/components/layout/primitives";
import { ReportCard } from "@/components/reports/report-card";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveReportDefinitions } from "@/lib/reports/catalog";

export const metadata: Metadata = {
  title: "Astrology Reports",
  description: "Personalized Vedic astrology reports prepared from saved Ravish Astro birth profiles.",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await listActiveReportDefinitions();

  return (
    <Section className="star-field">
      <SectionHeader
        title="Astrology reports"
        text="Choose a focused report and checkout with a saved birth profile. Report delivery is kept separate from free Kundli generation."
      />

      {reports.length === 0 ? (
        <EmptyState message="Report checkout is being prepared." title="No reports available" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportCard report={report} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
