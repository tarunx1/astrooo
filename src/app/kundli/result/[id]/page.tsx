import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AstrologyPageShell } from "@/components/astrology/page-shell";
import {
  CalculationMetadata,
  CoreAstrologySummary,
  DashaSummary,
  FixtureNotice,
  InsightPreview,
  KundliOverview,
  ManglikSummary,
  PlanetaryPositionsTable,
} from "@/components/kundli/result-sections";
import { KundliCharts } from "@/components/astrology/kundli-charts";
import { TransitChartSection } from "@/components/astrology/transit-chart-section";
import { DashaTable } from "@/components/astrology/dasha-table";
import { SaveKundliCard } from "@/components/kundli/save-kundli";
import { EditKundliDetails } from "@/components/kundli/edit-kundli-details";
import { getKundliResult } from "@/lib/kundli/service";
import { getCurrentUser } from "@/lib/auth/session";
import { consumeContinuation } from "@/lib/auth/continuation";
import { isKundliSavedByUser } from "@/lib/account/saved-kundlis";

export const metadata: Metadata = {
  title: "Private Kundli Result",
  description: "Private generated Kundli result.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function KundliResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getKundliResult(id);
  if (!result) notFound();

  // Anonymous access by result token is preserved: the id itself is the
  // capability. Saving, by contrast, requires both a session and a continuation.
  const user = await getCurrentUser();
  const [isSaved, hasPendingContinuation] = await Promise.all([
    user ? isKundliSavedByUser(user.id, id) : Promise.resolve(false),
    consumeContinuation(id),
  ]);

  return (
    <AstrologyPageShell>
        <KundliOverview
          actions={
            result.person && result.location ? (
              <EditKundliDetails
                defaults={{
                  name: result.person.name ?? "",
                  gender: result.person.gender,
                  dateOfBirth: result.person.dateOfBirth ?? "",
                  timeOfBirth: result.person.timeOfBirth ?? "",
                  timeAccuracy: result.person.timeAccuracy ?? "EXACT",
                  place: {
                    placeId: result.location.placeId ?? "",
                    displayName: result.location.displayName ?? "",
                    city: result.location.city ?? "",
                    region: result.location.region ?? "",
                    country: result.location.country ?? "",
                  },
                }}
              />
            ) : undefined
          }
          result={result}
        />
        <SaveKundliCard
          calculationId={id}
          hasPendingContinuation={hasPendingContinuation}
          isAuthenticated={Boolean(user)}
          isSaved={isSaved}
        />
        <FixtureNotice result={result} />
        <CoreAstrologySummary result={result} />
        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0"><KundliCharts result={result} /></div>
          {/* The positions table is short and the charts beside it are tall, so
              the dasha sits under it rather than leaving that column empty
              half way down the page. The transit chart follows for the same
              reason - it fills the space the dasha leaves, and it belongs next
              to the positions it is meant to be read against. */}
          <div className="grid min-w-0 gap-6 self-start">
            <PlanetaryPositionsTable result={result} />
            <DashaTable result={result} />
            <TransitChartSection result={result} />
          </div>
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <DashaSummary result={result} />
          <ManglikSummary result={result} />
        </section>
        <InsightPreview />
        <CalculationMetadata result={result} />
    </AstrologyPageShell>
  );
}
