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
import { KaalSarpSummary } from "@/components/astrology/kaal-sarp-summary";
import { createRashiChart } from "@/lib/astrology/charts/factory";

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
        {/*
          The chart stays put while the tables are read.

          Sticky rather than a scroll container on the data column: one page
          scrollbar instead of two, find-in-page still reaches the tables, and
          nothing needs a tabindex to be keyboard-reachable.

          Sticky alone was not enough. Seven banded tab rows, a 28rem chart and
          a nine-row position table make this card roughly half again the height
          of a laptop viewport, and a sticky box taller than the viewport
          scrolls away like any other - the chart was gone by the time the dasha
          was on screen. Capping the column at the viewport and letting it
          scroll inside is what actually keeps it there. The cap is `lg:` only,
          so the stacked phone layout is untouched.

          `min-w-0` on both columns, and `astro-layout-guard` for everything
          nested inside them, is what stops either one's contents from setting
          the grid track's width - a grid or flex item will not otherwise shrink
          below its content, which is what put the tables over the chart. The
          guard is needed as well as the two `min-w-0`s because the panels nest
          several grids deep and every level re-introduces the default; see the
          rule in globals.css.
        */}
        <section className="astro-layout-guard grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* The max-height is the viewport less the header and this column's
              own sticky offset, so a tall tab (Ashtakavarga, KP) scrolls inside
              the pinned card rather than dragging the chart off the top. */}
          <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100dvh-var(--header-height)-3rem)] lg:self-start lg:overflow-y-auto">
            <KundliCharts result={result} />
          </div>
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
          <KaalSarpSummary chart={createRashiChart({ ascendant: result.ascendant, planets: result.planets })} />
        </section>
        <InsightPreview />
        <CalculationMetadata result={result} />
    </AstrologyPageShell>
  );
}
