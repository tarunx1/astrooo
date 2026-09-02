import { AlertTriangle, ArrowRight, LockKeyhole } from "lucide-react";
import type { KundliResult } from "@/lib/kundli/types";
import { Button } from "@/components/ui/button";

export function KundliOverview({ result }: { result: KundliResult }) {
  const rows = [
    ["Name", result.person.name],
    ["Date", result.person.dateOfBirth],
    ["Time", `${result.person.timeOfBirth} (${result.person.timeAccuracy.toLowerCase()})`],
    ["Birth Place", result.location.displayName],
  ];

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="caption uppercase text-premium">Free Janam Kundli</p>
          <h1 className="mt-3 heading-xl">{result.person.name}</h1>
          <p className="mt-3 body text-foreground-secondary">Generated from normalized birth details and calculation metadata.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 caption text-foreground-muted">
          <LockKeyhole size={14} /> Private result
        </div>
      </div>
      <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div className="rounded-md border border-border bg-background p-4" key={label}>
            <dt className="caption text-foreground-muted">{label}</dt>
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
      {summaries.map(([label, value]) => (
        <div className="rounded-lg border border-border bg-surface p-5" key={label}>
          <p className="caption uppercase text-foreground-muted">{label}</p>
          <p className="mt-3 heading-md text-premium">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function PlanetaryPositionsTable({ result }: { result: KundliResult }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-lg">Planetary Positions</h2>
      <div className="mt-5 grid gap-3 md:hidden">
        {result.planets.map((planet) => (
          <article className="rounded-md border border-border bg-background p-4" key={planet.planet}>
            <div className="flex items-center justify-between gap-4">
              <h3 className="font-semibold">{planet.planet}</h3>
              <span className="caption text-premium">{planet.retrograde ? "Retrograde" : "Direct"}</span>
            </div>
            <p className="mt-2 body-sm text-foreground-secondary">
              {planet.sign}, House {planet.house}, {planet.degreeInSign}°
            </p>
            <p className="mt-1 body-sm text-foreground-muted">
              {planet.nakshatra}, Pada {planet.nakshatraPada}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-5 hidden overflow-hidden rounded-md border border-border md:block">
        <table className="w-full border-collapse text-left body-sm">
          <thead className="bg-background text-foreground-muted">
            <tr>
              {["Planet", "Sign", "House", "Degree", "Nakshatra", "Status"].map((heading) => (
                <th className="px-4 py-3 font-semibold" key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.planets.map((planet) => (
              <tr key={planet.planet}>
                <td className="px-4 py-3 font-semibold">{planet.planet}</td>
                <td className="px-4 py-3">{planet.sign}</td>
                <td className="px-4 py-3">{planet.house}</td>
                <td className="px-4 py-3">{planet.degreeInSign}°</td>
                <td className="px-4 py-3">{planet.nakshatra}</td>
                <td className="px-4 py-3">{planet.retrograde ? "Retrograde" : "Direct"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DashaSummary({ result }: { result: KundliResult }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-lg">Vimshottari Dasha</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryBox label="Mahadasha" value={result.vimshottariDasha.currentMahadasha} />
        <SummaryBox label="Antardasha" value={result.vimshottariDasha.currentAntardasha} />
        <SummaryBox label="Balance" value={result.vimshottariDasha.balance} />
      </div>
    </section>
  );
}

export function ManglikSummary({ result }: { result: KundliResult }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-lg">Manglik Status</h2>
      <p className="mt-4 heading-md text-premium">{result.manglik.status}</p>
      <p className="mt-2 body text-foreground-secondary">{result.manglik.summary}</p>
    </section>
  );
}

export function InsightPreview() {
  const ctas = ["Get Your Complete Life Report", "Explore Career Insights", "Check Kundli Compatibility", "Discover Recommended Gemstones"];
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-lg">Continue with deeper guidance</h2>
      <p className="mt-3 body text-foreground-secondary">These next steps are prepared for future paid reports and commerce flows. They do not generate reports yet.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {ctas.map((label) => (
          <Button className="justify-between" href="/reports" key={label} variant="secondary">
            {label} <ArrowRight size={16} />
          </Button>
        ))}
      </div>
    </section>
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
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="heading-md">Calculation Metadata</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="caption text-foreground-muted">{label}</dt>
            <dd className="mt-1 body-sm text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <p className="caption text-foreground-muted">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  );
}
