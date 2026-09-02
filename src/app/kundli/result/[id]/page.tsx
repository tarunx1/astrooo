import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer, Section } from "@/components/layout/primitives";
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
import { KundliChart } from "@/components/kundli/kundli-chart";
import { SaveKundliCard } from "@/components/kundli/save-kundli";
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
    <Section className="star-field">
      <PageContainer className="grid gap-6 px-0">
        <KundliOverview result={result} />
        <SaveKundliCard
          calculationId={id}
          hasPendingContinuation={hasPendingContinuation}
          isAuthenticated={Boolean(user)}
          isSaved={isSaved}
        />
        <FixtureNotice result={result} />
        <CoreAstrologySummary result={result} />
        <section className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <KundliChart data={result.chart} />
          <PlanetaryPositionsTable result={result} />
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <DashaSummary result={result} />
          <ManglikSummary result={result} />
        </section>
        <InsightPreview />
        <CalculationMetadata result={result} />
      </PageContainer>
    </Section>
  );
}
