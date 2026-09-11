import { DashaFormulaPanel } from "@/components/astrology/dasha-formula-panel";
import { buildDashaTimeline, formatBalance } from "@/lib/astrology/engine/dasha";
import { HouseSystemUnavailableError } from "@/lib/astrology/engine/houses";
import { computeKpChartForBirth, type KpChart } from "@/lib/astrology/kp/chart";
import { significatorsFor } from "@/lib/astrology/kp/significators";
import type { KundliResult } from "@/lib/kundli/types";

/**
 * The Vimshottari dasha, read the way KP reads it.
 *
 * A period is judged by what its lord signifies, so each lord is shown with
 * its houses rather than by name alone - the same houses the Nakshatra Nadi
 * table gives it, from the same chart, so the two can be read together.
 *
 * The chart is calculated here and only the three small things the tree needs
 * cross into the browser: the birth instant, the Moon's longitude, and the
 * houses per planet. The periods themselves are arithmetic on those, so the
 * tree can open a level without asking the server for it.
 */
export function DashaTable({ result }: { result: KundliResult }) {
  let chart: KpChart;
  try {
    chart = computeKpChartForBirth(
      { dateOfBirth: result.person.dateOfBirth, timeOfBirth: result.person.timeOfBirth },
      {
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        timezone: result.location.timezone,
      },
    );
  } catch (error) {
    if (error instanceof HouseSystemUnavailableError) {
      // The dates would still be right, but the houses beside each lord come
      // from Placidus cusps, and half a table is worse than a plain reason.
      return (
        <section className="astro-inner-card grid gap-2 p-4 sm:p-5">
          <h3 className="body-sm font-semibold text-foreground">Vimshottari Dasha</h3>
          <p className="body-sm text-foreground-secondary">
            House significations cannot be calculated for this birth place, so the dasha is not shown here. Its
            periods are unaffected and appear in the summary below.
          </p>
        </section>
      );
    }
    throw error;
  }

  const moon = chart.planets.find((planet) => planet.planet === "Moon")!;
  const timeline = buildDashaTimeline(chart.instant, moon.longitude, 1);

  const houses: Record<string, number[]> = {};
  const lordDetails: Record<string, { starLord: string; subLord: string }> = {};
  for (const planet of chart.planets) {
    houses[planet.planet] = significatorsFor(planet, chart).ownHouses;
    lordDetails[planet.planet] = {
      starLord: planet.lords.starLord,
      subLord: planet.lords.subLord,
    };
  }

  return (
    <section className="astro-inner-card grid gap-3 p-4 sm:p-5">
      <div>
        <h3 className="body-sm font-semibold text-foreground">Vimshottari Dasha</h3>
        <p className="caption text-foreground-muted">
          From birth, with the houses each lord signifies. Balance at birth {formatBalance(timeline.balanceYears)}.
        </p>
      </div>

      <DashaFormulaPanel
        birthISO={chart.instant.toISOString()}
        houses={houses}
        lordDetails={lordDetails}
        moonLongitude={moon.longitude}
      />

      <p className="caption text-foreground-muted">
        The period running now is open, down to Pratyantardasha. Open any other with the + beside it. Lords are
        abbreviated in the trail: Su Sun, Mo Moon, Ma Mars, Me Mercury, Ju Jupiter, Ve Venus, Sa Saturn, Ra Rahu,
        Ke Ketu.
      </p>
    </section>
  );
}
