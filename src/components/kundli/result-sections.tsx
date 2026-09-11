import { AlertTriangle, ArrowRight, LockKeyhole } from "lucide-react";
import type { KundliResult } from "@/lib/kundli/types";
import { Badge } from "@/components/ui/badge";
import { AstrologyDataTable, type AstrologyTableColumn } from "@/components/astrology/data-table";
import { AstrologySection } from "@/components/astrology/section";
import { AstrologyStatCard } from "@/components/astrology/stat-card";
import { AstrologyStatusCard } from "@/components/astrology/status-card";

export function KundliOverview({ result }: { result: KundliResult }) {
  const rows = [
    ["Name", result.person.name],
    ["Date", result.person.dateOfBirth],
    ["Time", `${result.person.timeOfBirth} (${result.person.timeAccuracy.toLowerCase()})`],
    ["Birth Place", result.location.displayName],
  ];

  return (
    <section className="astro-card relative overflow-hidden p-5 sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="caption uppercase tracking-[0.1em] text-premium">Free Janam Kundli</p>
          <h1 className="mt-3 text-display-lg">{result.person.name}</h1>
          <p className="mt-3 body text-foreground-secondary">Generated from normalized birth details and calculation metadata.</p>
        </div>
        <Badge className="gap-2 self-start"><LockKeyhole aria-hidden="true" size={14} /> Private result</Badge>
      </div>
      <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div className="astro-inner-card p-4" key={label}>
            <dt className="caption uppercase tracking-[0.08em] text-foreground-muted">{label}</dt>
            <dd className="mt-1 body-sm font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function FixtureNotice({ result }: { result: KundliResult }) {
  if (!result.calculationMetadata.isDevelopmentFixture) return null;

  return (
    <div className="flex gap-3 rounded-lg border border-warning/60 bg-surface p-5 text-warning">
      <AlertTriangle className="mt-0.5 shrink-0" size={20} />
      <div>
        <h2 className="heading-md">Development calculation fixture</h2>
        <p className="mt-2 body-sm text-foreground-secondary">
          This result proves the product flow, storage, chart rendering and provider adapter. It is not a genuine astronomical calculation and must be replaced before production astrology use.
        </p>
        <p className="mt-2 body-sm text-foreground-secondary">
          Account support can later save this Kundli to an authenticated birth-profile library without blocking anonymous access.
        </p>
      </div>
    </div>
  );
}

export function CoreAstrologySummary({ result }: { result: KundliResult }) {
  const summaries = [
    ["Lagna", `${result.ascendant.sign} ${result.ascendant.degree}°`],
    ["Moon Sign", result.moonSign],
    ["Sun Sign", result.sunSign],
    ["Nakshatra", `${result.nakshatra.name}, Pada ${result.nakshatra.pada}`],
  ];

  return (
    <section className="grid gap-4 md:grid-cols-4">
      {summaries.map(([label, value]) => <AstrologyStatCard key={label} label={label} value={value} />)}
    </section>
  );
}

export function PlanetaryPositionsTable({ result }: { result: KundliResult }) {
  type Planet = KundliResult["planets"][number];
  const columns: AstrologyTableColumn<Planet>[] = [
    { id: "planet", label: "Planet", rowHeader: true, cell: (planet) => <span className="font-semibold text-foreground">{planet.planet}</span> },
    { id: "sign", label: "Sign", cell: (planet) => planet.sign },
    { id: "house", label: "House", cell: (planet) => planet.house },
    { id: "degree", label: "Degree", cell: (planet) => `${planet.degreeInSign}°` },
    { id: "nakshatra", label: "Nakshatra", cell: (planet) => `${planet.nakshatra}, Pada ${planet.nakshatraPada}` },
    { id: "status", label: "Status", cell: (planet) => <span className={planet.retrograde ? "text-premium" : "text-foreground-secondary"}>{planet.retrograde ? "Retrograde" : "Direct"}</span> },
  ];

  return (
    <AstrologySection className="self-start" title="Planetary Positions">
      <AstrologyDataTable columns={columns} rowKey={(planet) => planet.planet} rows={result.planets} />
    </AstrologySection>
  );
}

export function DashaSummary({ result }: { result: KundliResult }) {
  return (
    <AstrologySection title="Vimshottari Dasha">
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <AstrologyStatCard label="Mahadasha" value={result.vimshottariDasha.currentMahadasha} />
        <AstrologyStatCard label="Antardasha" value={result.vimshottariDasha.currentAntardasha} />
        <AstrologyStatCard label="Balance" value={result.vimshottariDasha.balance} />
      </div>
    </AstrologySection>
  );
}

export function ManglikSummary({ result }: { result: KundliResult }) {
  return (
    <AstrologyStatusCard status={result.manglik.status} title="Manglik Status">{result.manglik.summary}</AstrologyStatusCard>
  );
}

export function InsightPreview() {
  const ctas = [
    { label: "Get Your Complete Life Report", href: "/reports" },
    { label: "Explore Career Insights", href: "/reports" },
    { label: "Check Kundli Compatibility", href: "/kundli-matching" },
    { label: "Discover Recommended Gemstones", href: "/shop" },
  ];
  return (
    <AstrologySection title="Continue with deeper guidance">
      <p className="mt-3 body text-foreground-secondary">These next steps are prepared for future paid reports and commerce flows. They do not generate reports yet.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {ctas.map((cta) => (
          <a
            className="astro-inner-card group flex min-h-16 items-center justify-between gap-4 p-4 transition hover:border-primary/70 hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            href={cta.href}
            key={cta.label}
          >
            <span className="body-sm font-semibold text-foreground">{cta.label}</span>
            <ArrowRight aria-hidden="true" className="shrink-0 text-premium transition-transform group-hover:translate-x-0.5" size={17} />
          </a>
        ))}
      </div>
    </AstrologySection>
  );
}

export function CalculationMetadata({ result }: { result: KundliResult }) {
  const rows = [
    ["Provider", result.calculationMetadata.provider],
    ["Provider version", result.calculationMetadata.providerVersion],
    ["Calculation version", result.calculationMetadata.calculationVersion],
    ["Ayanamsa", result.calculationMetadata.ayanamsa],
    ["House system", result.calculationMetadata.houseSystem],
    ["Calculated at", result.calculationMetadata.calculatedAt],
  ];

  return (
    <AstrologySection headingLevel="h2" title="Calculation Metadata">
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div className="astro-inner-card p-4" key={label}>
            <dt className="caption uppercase tracking-[0.08em] text-foreground-muted">{label}</dt>
            <dd className="mt-1 body-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </AstrologySection>
  );
}
