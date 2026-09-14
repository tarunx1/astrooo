import { Suspense } from "react";
import { ChartPanel } from "@/components/astrology/chart-panel";
import { GocharPanel } from "@/components/astrology/gochar-panel";
import { KpPanel } from "@/components/astrology/kp-panel";
import { PlanetPositionTable } from "@/components/astrology/planet-position-table";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { Card } from "@/components/ui/card";
import { AshtakavargaPanel } from "@/components/astrology/ashtakavarga-panel";
import { BalaPanel } from "@/components/astrology/bala-panel";
import { JaiminiPanel } from "@/components/astrology/jaimini-panel";
import { YogasPanel } from "@/components/astrology/yogas-panel";
import { RelationshipsPanel } from "@/components/astrology/relationships-panel";
import { DivisionalCharts } from "@/components/astrology/divisional-charts";
import {
  createChartsFromKundli,
  createDivisionalChart,
  createShodashvarga,
} from "@/lib/astrology/charts/factory";
import { VARGA_DEFINITIONS } from "@/lib/astrology/charts/varga";
import { getSignNumberFromName } from "@/lib/astrology/charts/signs";
import type { KundliResult } from "@/lib/kundli/types";

/**
 * The chart views for one calculation.
 *
 * Every chart here is derived from the same stored longitudes by our own
 * placement code, so a chart is reproducible from the calculation alone and a
 * historical report always draws exactly what it drew before.
 *
 * The Navamsa is offered only when the ascendant's exact degree is available.
 * The D9 ascendant is the navamsa of the rising degree, and a sign alone cannot
 * produce it - showing an approximation would be worse than showing nothing.
 *
 * Gochar streams in on its own, because it is the only view here that needs a
 * live provider call. Everything else comes from the stored calculation.
 */
export function KundliCharts({ result }: { result: KundliResult }) {
  const { rashi, navamsa, moon, warnings } = createChartsFromKundli(result);
  const moonSign = getSignNumberFromName(result.moonSign);

  // All sixteen are calculated here, on the server, from the stored longitudes.
  // They are a few numbers each; the cost that matters is rendering them, which
  // the divisional view defers by drawing one at a time.
  const shodashvarga = createShodashvarga(rashi);
  const divisional =
    typeof rashi.ascendantLongitude === "number"
      ? VARGA_DEFINITIONS.map(({ division, name, significance }) => ({
          division,
          name,
          significance,
          data: createDivisionalChart(rashi, division),
        }))
      : [];

  const tabs = [
    {
      group: "Charts",
      id: "d1",
      label: "D1 Rashi",
      content: (
        <div className="grid gap-5">
          <VedicChart data={rashi} label="D1 Rashi chart" showDegrees />
          <PlanetPositionTable caption="Planetary positions in the Rashi chart" data={rashi} />
        </div>
      ),
    },
    ...(navamsa
      ? [
          {
            group: "Charts",
            id: "d9",
            label: "D9 Navamsa",
            content: (
              <div className="grid gap-5">
                <VedicChart data={navamsa} label="D9 Navamsa chart" showDegrees />
                <PlanetPositionTable caption="Planetary positions in the Navamsa chart" data={navamsa} />
              </div>
            ),
          },
        ]
      : []),
    {
      group: "Charts",
      id: "moon",
      label: "Moon",
      content: (
        <div className="grid gap-5">
          <VedicChart data={moon} label="Moon chart" showDegrees />
          <PlanetPositionTable caption="Planetary positions from the Moon" data={moon} />
        </div>
      ),
    },
    // Offered only when the ascendant's exact degree is known, for the same
    // reason the Navamsa is: every varga ascendant is a division of the rising
    // degree, and a sign alone cannot produce one.
    ...(divisional.length > 0
      ? [
          {
            group: "Charts",
            id: "divisional",
            label: "Divisional",
            content: <DivisionalCharts charts={divisional} table={shodashvarga} />,
          },
        ]
      : []),
    {
      group: "Strength",
      id: "ashtakavarga",
      label: "Ashtakavarga",
      content: <AshtakavargaPanel chart={rashi} />,
    },
    {
      group: "Strength",
      id: "bala",
      label: "Strength",
      content: <BalaPanel chart={rashi} />,
    },
    {
      group: "Advanced",
      id: "relationships",
      label: "Relationships",
      content: <RelationshipsPanel chart={rashi} />,
    },
    {
      group: "Jaimini",
      id: "jaimini",
      label: "Jaimini",
      content: <JaiminiPanel chart={rashi} />,
    },
    {
      group: "Yogas",
      id: "yogas",
      label: "Yogas",
      content: <YogasPanel chart={rashi} />,
    },
    {
      group: "Transits",
      id: "gochar",
      label: "Gochar",
      content: (
        <Suspense fallback={<p className="body-sm text-foreground-muted">Loading current transits…</p>}>
          <GocharPanel ascendantSign={rashi.ascendantSign} moonSign={moonSign} />
        </Suspense>
      ),
    },
    {
      group: "KP",
      id: "kp",
      label: "KP",
      content: <KpPanel result={result} />,
    },
  ];

  return (
    <Card className="p-5 sm:p-6">
      <ChartPanel tabs={tabs} />

      {warnings.length > 0 ? (
        <div className="mt-5 rounded-md border border-warning/40 p-3">
          <p className="caption text-warning">Source data check</p>
          <ul className="mt-1 grid gap-1">
            {warnings.map((warning) => (
              <li className="caption text-foreground-secondary" key={warning}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
