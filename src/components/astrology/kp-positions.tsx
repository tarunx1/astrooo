import { sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";
import { getKpPosition } from "@/lib/astrology/kp/vimshottari";

function SignificatorCell({
  planetName,
  houses,
  retrograde,
  highlight = false,
}: {
  planetName: string;
  houses?: number[];
  retrograde?: boolean;
  highlight?: boolean;
}) {
  const houseStr = houses && houses.length > 0 ? houses.join(",") : null;

  return (
    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={highlight ? "font-bold text-foreground" : "font-medium text-foreground-secondary"}>
        {planetName.toUpperCase()}
      </span>
      {houseStr ? (
        <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs font-mono font-semibold text-primary">
          {houseStr}
        </span>
      ) : null}
      {retrograde ? (
        <span className="rounded border border-warning/40 bg-warning/10 px-1 text-[10px] font-bold text-warning" title="Retrograde">
          R
        </span>
      ) : null}
    </div>
  );
}

/**
 * KP star, sub and sub-sub lords for each planet alongside Nakshatra Nadi house significators.
 *
 * Krishnamurti Paddhati divides each nakshatra again in Vimshottari proportion,
 * giving 249 divisions across the zodiac; the lord of the division a planet
 * falls in is what the system reads. All of it is exact arithmetic on the
 * longitude, so nothing here is estimated.
 */
export function KpPositions({ data }: { data: VedicChartData }) {
  const planets = sortPlanetsForDisplay(data.planets);
  const ascendantSign = data.ascendantSign;

  return (
    <div className="@container grid gap-6">
      {/* Nakshatra Nadi House Significators Matrix */}
      <div className="rounded-lg border border-border bg-surface p-3.5 sm:p-5">
        <div className="mb-3">
          <h4 className="body-md font-semibold text-foreground">
            Nakshatra Nadi House Significators
          </h4>
          <p className="caption text-foreground-muted mt-0.5">
            Houses signified through Planet, Star Lord, and Sub Lord
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              Nakshatra Nadi KP house significators for planet, star lord, and sub lord
            </caption>
            <thead>
              <tr className="border-b border-border bg-surface-raised/50">
                <th className="py-2 px-2.5 sm:px-3 caption uppercase text-foreground-muted font-bold w-1/3" scope="col">
                  Planet
                </th>
                <th className="py-2 px-2.5 sm:px-3 caption uppercase text-foreground-muted font-bold w-1/3" scope="col">
                  Star Lord
                </th>
                <th className="py-2 px-2.5 sm:px-3 caption uppercase text-foreground-muted font-bold w-1/3" scope="col">
                  Sub Lord
                </th>
              </tr>
            </thead>
            <tbody>
              {planets.map((planet) => {
                const kp = getKpPosition(planet.longitude, ascendantSign, data.planets, planet.planet);
                return (
                  <tr className="border-b border-border/60 transition-colors hover:bg-surface-raised/50 last:border-0" key={planet.planet}>
                    <td className="py-2.5 px-2.5 sm:px-3">
                      <SignificatorCell
                        planetName={planet.planet}
                        houses={kp.planetHouses}
                        retrograde={planet.retrograde}
                        highlight
                      />
                    </td>
                    <td className="py-2.5 px-2.5 sm:px-3">
                      <SignificatorCell planetName={kp.starLord} houses={kp.starLordHouses} />
                    </td>
                    <td className="py-2.5 px-2.5 sm:px-3">
                      <SignificatorCell planetName={kp.subLord} houses={kp.subLordHouses} highlight />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete KP Star & Sub Lords Table */}
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        <h4 className="body-sm font-semibold text-foreground-muted mb-3 uppercase caption tracking-wider">
          KP Star & Sub Lords Breakdown
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left">
            <caption className="sr-only">
              KP star, sub and sub-sub lords for each planet, with its nakshatra and pada
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Planet
                </th>
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Position
                </th>
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Nakshatra
                </th>
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Star Lord
                </th>
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Sub Lord
                </th>
                <th className="py-2 px-3 caption uppercase text-foreground-muted" scope="col">
                  Sub-Sub
                </th>
              </tr>
            </thead>
            <tbody>
              {planets.map((planet) => {
                const kp = getKpPosition(planet.longitude, ascendantSign, data.planets, planet.planet);
                return (
                  <tr className="border-b border-border/60 transition-colors hover:bg-surface-raised/30 last:border-0" key={planet.planet}>
                    <th className="py-2 px-3 body-sm font-semibold text-foreground" scope="row">
                      <span className="whitespace-nowrap">
                        {planet.planet}
                        {planet.retrograde ? <span className="ml-1 text-[10px] font-bold text-warning">R</span> : null}
                      </span>
                    </th>
                    <td className="py-2 px-3 body-sm tabular-nums text-foreground-secondary whitespace-nowrap">
                      {getSignName(planet.sign).slice(0, 3)} {formatDegreeInSign(planet.degreeInSign)}
                    </td>
                    <td className="py-2 px-3 body-sm text-foreground-secondary whitespace-nowrap">
                      {kp.nakshatra} <span className="caption text-foreground-muted">({kp.pada})</span>
                    </td>
                    <td className="py-2 px-3 body-sm text-foreground-secondary font-medium whitespace-nowrap">{kp.starLord}</td>
                    <td className="py-2 px-3 body-sm font-semibold text-foreground whitespace-nowrap">{kp.subLord}</td>
                    <td className="py-2 px-3 body-sm text-foreground-secondary whitespace-nowrap">{kp.subSubLord}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
