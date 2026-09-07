import { getHouseFromSign } from "@/lib/astrology/charts/houses";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Where each transiting planet currently sits for this person.
 *
 * Both counts are given because both are used. Classical Gochar counts houses
 * from the natal Moon (Janma Rashi); modern practice often reads them from the
 * Lagna as well. Showing one and calling it "the" house would quietly pick a
 * side of that, so both are labelled and shown.
 */
export function GocharTable({
  transits,
  moonSign,
  ascendantSign,
}: {
  transits: VedicChartData;
  moonSign: number;
  ascendantSign: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Transiting planets counted from the natal Moon and from the Lagna</caption>
        <thead>
          <tr className="border-b border-border">
            {["Planet", "Transiting", "From Moon", "From Lagna"].map((heading) => (
              <th className="py-2 pr-2 caption uppercase text-foreground-muted" key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transits.planets.map((planet) => (
            <tr className="border-b border-border last:border-0" key={planet.planet}>
              <th className="py-2 pr-2 body-sm font-semibold text-foreground" scope="row">
                {planet.planet}
                {planet.retrograde ? <span className="ml-1 caption text-premium">R</span> : null}
              </th>
              <td className="py-2 pr-2 body-sm tabular-nums text-foreground-secondary">
                {getSignName(planet.sign)} {formatDegreeInSign(planet.degreeInSign)}
              </td>
              <td className="py-2 body-sm tabular-nums text-foreground">
                {getHouseFromSign(planet.sign, moonSign)}
              </td>
              <td className="py-2 pr-2 body-sm tabular-nums text-foreground-secondary">
                {getHouseFromSign(planet.sign, ascendantSign)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
