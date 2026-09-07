import { getHouseFromSign, sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Planet positions as a table.
 *
 * Derived from the same chart data and the same helpers as the drawing, so the
 * two can never disagree. Stacks into cards on narrow screens rather than
 * forcing a five-column table through a phone.
 */
export function PlanetPositionTable({ data, caption }: { data: VedicChartData; caption: string }) {
  const planets = sortPlanetsForDisplay(data.planets);

  return (
    <div className="grid gap-3">
      <table className="hidden w-full border-collapse text-left sm:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {["Planet", "Sign", "Degree", "House"].map((heading) => (
              <th className="py-2 caption uppercase text-foreground-muted" key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planets.map((planet) => (
            <tr className="border-b border-border last:border-0" key={planet.planet}>
              <th className="py-2 body-sm font-semibold text-foreground" scope="row">
                {planet.planet}
                {planet.retrograde ? <span className="ml-1 caption text-premium">R</span> : null}
              </th>
              <td className="py-2 body-sm text-foreground-secondary">{getSignName(planet.sign)}</td>
              <td className="py-2 body-sm tabular-nums text-foreground-secondary">
                {formatDegreeInSign(planet.degreeInSign)}
              </td>
              <td className="py-2 body-sm tabular-nums text-foreground-secondary">
                {getHouseFromSign(planet.sign, data.ascendantSign)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="grid gap-2 sm:hidden">
        {planets.map((planet) => (
          <li className="rounded-md border border-border p-3" key={planet.planet}>
            <div className="flex items-center justify-between gap-2">
              <span className="body-sm font-semibold text-foreground">
                {planet.planet}
                {planet.retrograde ? <span className="ml-1 caption text-premium">R</span> : null}
              </span>
              <span className="caption text-foreground-muted">
                House {getHouseFromSign(planet.sign, data.ascendantSign)}
              </span>
            </div>
            <p className="mt-1 body-sm text-foreground-secondary">
              {getSignName(planet.sign)} · {formatDegreeInSign(planet.degreeInSign)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
