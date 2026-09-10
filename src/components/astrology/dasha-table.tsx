import type { PlanetName } from "@/config/astrology";
import { HouseSystemUnavailableError } from "@/lib/astrology/engine/houses";
import { buildDashaTimeline, dashaChainAt, formatBalance, type DashaPeriod } from "@/lib/astrology/engine/dasha";
import { computeKpChartForBirth, type KpChart } from "@/lib/astrology/kp/chart";
import { significatorsFor } from "@/lib/astrology/kp/significators";
import type { KundliResult } from "@/lib/kundli/types";

/**
 * The Vimshottari dasha, read the way KP reads it.
 *
 * A period is judged by what its lord signifies, so each lord is shown with
 * its houses rather than by name alone - the same houses the Nakshatra Nadi
 * table gives it, from the same chart, so the two can be read together
 * without the reader having to hold one in their head while looking at the
 * other.
 *
 * The running period is expanded to its sub-periods. The others are not: the
 * whole hundred and twenty years at that depth is eighty-one rows, and only
 * the one in force is being lived through.
 */
const SHORT: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const year = (date: Date) =>
  date.toLocaleDateString("en-GB", { year: "numeric", month: "short", timeZone: "UTC" });

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
  const timeline = buildDashaTimeline(chart.instant, moon.longitude, 2);
  const chain = dashaChainAt(timeline, chart.instant);
  const birthLord = chain[0]?.lord ?? timeline.birthLord;

  const houses = new Map<PlanetName, number[]>(
    chart.planets.map((planet) => [planet.planet, significatorsFor(planet, chart).ownHouses]),
  );
  const label = (lord: PlanetName) => {
    const signifies = houses.get(lord);
    return `${lord.toUpperCase()}-${signifies?.length ? signifies.join(",") : "—"}`;
  };

  return (
    <section className="astro-inner-card grid gap-3 p-4 sm:p-5">
      <div>
        <h3 className="body-sm font-semibold text-foreground">Vimshottari Dasha</h3>
        <p className="caption text-foreground-muted">
          Each lord with the houses it signifies. Balance at birth {formatBalance(timeline.balanceYears)}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[20rem] border-collapse text-left">
          <caption className="sr-only">
            Vimshottari mahadasha periods with the houses each lord signifies, the running period expanded
          </caption>
          <thead className="bg-premium text-background">
            <tr>
              {["Mahadasha", "From", "To"].map((heading) => (
                <th className="border-r border-background/25 px-3 py-2 text-sm font-semibold last:border-r-0" key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeline.periods.map((period) => (
              <PeriodRows atBirth={period.lord === birthLord} key={period.lord} label={label} period={period} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="caption text-foreground-muted">
        The period running at birth is expanded to its antardashas. Lords are abbreviated in the sub-rows: Su Sun,
        Mo Moon, Ma Mars, Me Mercury, Ju Jupiter, Ve Venus, Sa Saturn, Ra Rahu, Ke Ketu.
      </p>
    </section>
  );
}

function PeriodRows({
  period,
  atBirth,
  label,
}: {
  period: DashaPeriod;
  atBirth: boolean;
  label: (lord: PlanetName) => string;
}) {
  return (
    <>
      <tr className={atBirth ? "border-t border-border bg-surface-raised" : "border-t border-border"}>
        <th className="border-r border-border px-3 py-2 text-left font-medium text-foreground" scope="row">
          {label(period.lord)}
        </th>
        <td className="border-r border-border px-3 py-2 tabular-nums text-foreground-secondary">
          {year(period.start)}
        </td>
        <td className="px-3 py-2 tabular-nums text-foreground-secondary">{year(period.end)}</td>
      </tr>

      {atBirth
        ? period.periods?.map((sub) => (
            <tr className="border-t border-border/60" key={`${period.lord}-${sub.lord}`}>
              <th className="border-r border-border px-3 py-1.5 pl-7 text-left caption font-normal text-foreground-muted" scope="row">
                <abbr title={period.lord}>{SHORT[period.lord]}</abbr>
                {" / "}
                <span className="text-foreground-secondary">{label(sub.lord)}</span>
              </th>
              <td className="border-r border-border px-3 py-1.5 caption tabular-nums text-foreground-muted">
                {year(sub.start)}
              </td>
              <td className="px-3 py-1.5 caption tabular-nums text-foreground-muted">{year(sub.end)}</td>
            </tr>
          ))
        : null}
    </>
  );
}
