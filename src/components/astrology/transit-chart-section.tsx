import { TransitChartSwitcher } from "@/components/astrology/transit-chart-switcher";
import { Card } from "@/components/ui/card";
import { createChartsFromKundli } from "@/lib/astrology/charts/factory";
import { getSignNumberFromName } from "@/lib/astrology/charts/signs";
import type { KundliResult } from "@/lib/kundli/types";

/**
 * The Lagna/Gochar chart, as its own panel.
 *
 * A thin server wrapper so the page stays declarative and the derivation lives
 * next to the thing that needs it. The natal chart is built here, from the
 * stored calculation, and handed to the client component already computed - the
 * transit side is the only part that talks to the server, and it can never
 * re-derive or overwrite the birth chart.
 */
export function TransitChartSection({ result }: { result: KundliResult }) {
  const { rashi } = createChartsFromKundli(result);

  return (
    <Card className="p-5 sm:p-6">
      <TransitChartSwitcher
        natal={rashi}
        natalLagnaSign={rashi.ascendantSign}
        natalMoonSign={getSignNumberFromName(result.moonSign)}
      />
    </Card>
  );
}
