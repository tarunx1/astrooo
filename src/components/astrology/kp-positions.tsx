import type { PlanetName } from "@/config/astrology";
import { sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import { PLANET_ABBREVIATIONS } from "@/lib/astrology/charts/labels";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { getKpPosition } from "@/lib/astrology/kp/vimshottari";

/** A lord, abbreviated as KP tables conventionally write them, still readable to a screen reader. */
function Lord({ planet }: { planet: PlanetName }) {
  return <abbr title={planet}>{PLANET_ABBREVIATIONS[planet]}</abbr>;
}

/**
 * KP star, sub and sub-sub lords for each planet.
 *
 * Krishnamurti Paddhati divides each nakshatra again in Vimshottari proportion,
 * giving 249 divisions across the zodiac; the lord of the division a planet
 * falls in is what the system reads. All of it is exact arithmetic on the
 * longitude, so nothing here is estimated.
 *
 * The three lords are the reading, so they are abbreviated rather than dropped:
 * this table lives in one column of the result page and is much narrower than
 * the window around it, and a sub-sub lord that disappears on a desktop is a
 * missing answer rather than a tidier table. Only the position, which the Rashi
 * table on the same page already gives in full, waits for spare width.
 */
export function KpPositions({ data }: { data: VedicChartData }) {
  const planets = sortPlanetsForDisplay(data.planets);

  return (
    <div className="@container">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          KP star, sub and sub-sub lords for each planet, with its nakshatra and pada
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 pr-2 caption uppercase text-foreground-muted" scope="col">
              Planet
            </th>
            <th className="hidden py-2 pr-2 caption uppercase text-foreground-muted @xl:table-cell" scope="col">
              Position
            </th>
            <th className="py-2 pr-2 caption uppercase text-foreground-muted" scope="col">
              Nakshatra
            </th>
            <th className="py-2 pr-2 caption uppercase text-foreground-muted" scope="col">
              Star
            </th>
            <th className="py-2 pr-2 caption uppercase text-foreground-muted" scope="col">
              Sub
            </th>
            <th className="py-2 caption uppercase text-foreground-muted" scope="col">
              Sub-sub
            </th>
          </tr>
        </thead>
        <tbody>
          {planets.map((planet) => {
            const kp = getKpPosition(planet.longitude);
            return (
              <tr className="border-b border-border last:border-0" key={planet.planet}>
                <th className="py-2 pr-2 body-sm font-semibold text-foreground" scope="row">
                  {planet.planet}
                  {planet.retrograde ? <span className="ml-1 caption text-premium">R</span> : null}
                </th>
                <td className="hidden py-2 pr-2 body-sm tabular-nums text-foreground-secondary @xl:table-cell">
                  {getSignName(planet.sign).slice(0, 3)} {formatDegreeInSign(planet.degreeInSign)}
                </td>
                <td className="py-2 pr-2 body-sm text-foreground-secondary">
                  {kp.nakshatra} <span className="caption text-foreground-muted">({kp.pada})</span>
                </td>
                <td className="py-2 pr-2 body-sm text-foreground-secondary">
                  <Lord planet={kp.starLord} />
                </td>
                <td className="py-2 pr-2 body-sm font-semibold text-foreground">
                  <Lord planet={kp.subLord} />
                </td>
                <td className="py-2 body-sm text-foreground-secondary">
                  <Lord planet={kp.subSubLord} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 caption text-foreground-muted">
        Nakshatra pada in brackets. Lords are abbreviated: Su Sun, Mo Moon, Ma Mars, Me Mercury, Ju Jupiter, Ve
        Venus, Sa Saturn, Ra Rahu, Ke Ketu.
      </p>
    </div>
  );
}
