import { ChartPanel } from "@/components/astrology/chart-panel";
import { PlanetPositionTable } from "@/components/astrology/planet-position-table";
import { VedicChart } from "@/components/astrology/vedic-chart";
import { Card } from "@/components/ui/card";
import { createChartsFromKundli } from "@/lib/astrology/charts/factory";
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
 */
export function KundliCharts({ result }: { result: KundliResult }) {
  const { rashi, navamsa, moon, warnings } = createChartsFromKundli(result);

  const tabs = [
    {
      id: "d1",
      label: "D1 Rashi",
      content: (
        <div className="grid gap-5">
          <VedicChart data={rashi} label="D1 Rashi chart" />
          <PlanetPositionTable caption="Planetary positions in the Rashi chart" data={rashi} />
        </div>
      ),
    },
    ...(navamsa
      ? [
          {
            id: "d9",
            label: "D9 Navamsa",
            content: (
              <div className="grid gap-5">
                <VedicChart data={navamsa} label="D9 Navamsa chart" />
                <PlanetPositionTable caption="Planetary positions in the Navamsa chart" data={navamsa} />
              </div>
            ),
          },
        ]
      : []),
    {
      id: "moon",
      label: "Moon",
      content: (
        <div className="grid gap-5">
          <VedicChart data={moon} label="Moon chart" />
          <PlanetPositionTable caption="Planetary positions from the Moon" data={moon} />
        </div>
      ),
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
