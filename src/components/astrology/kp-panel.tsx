import { HouseSystemUnavailableError } from "@/lib/astrology/engine/houses";
import { computeKpChartForBirth, type KpChart } from "@/lib/astrology/kp/chart";
import { allSignificators, type PlanetSignificators } from "@/lib/astrology/kp/significators";
import type { KundliResult } from "@/lib/kundli/types";

/** Two-letter planet labels, as KP tables conventionally write them. */
const SHORT: Record<string, string> = {
  Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me",
  Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke",
};

const Lord = ({ planet }: { planet: string }) => <abbr title={planet}>{SHORT[planet] ?? planet}</abbr>;

const degrees = (value: number) => {
  const d = Math.floor(value);
  const m = Math.floor((value - d) * 60);
  return `${String(d).padStart(2, "0")}°${String(m).padStart(2, "0")}'`;
};

/**
 * Krishnamurti Paddhati.
 *
 * KP is not a different reading of the same chart, it is a different chart.
 * It uses Placidus cusps rather than whole-sign houses, so a house begins part
 * way through a sign and a planet routinely sits in a different house from the
 * one the Rashi chart gives it. That is shown explicitly below rather than
 * quietly swapped, because a reader comparing the two tabs would otherwise
 * think one of them was wrong.
 */
export function KpPanel({ result }: { result: KundliResult }) {
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
      return (
        <p className="body-sm text-foreground-secondary">
          KP cannot be calculated for this birth place. It is defined on Placidus house cusps, which do not exist
          inside the polar circles because parts of the ecliptic never rise there. The other charts are unaffected.
        </p>
      );
    }
    throw error;
  }

  const significators = new Map(allSignificators(chart).map((entry) => [entry.planet, entry]));
  const moved = chart.planets.filter((planet) => planet.house !== planet.wholeSignHouse).length;

  return (
    <div className="@container grid gap-6">
      <section className="grid gap-2">
        <h3 className="body-sm font-semibold text-foreground">Cuspal sub-lords</h3>
        <p className="caption text-foreground-muted">
          KP judges a matter by the sub lord of the cusp that governs it, so this is the table the system turns on.
        </p>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Placidus house cusps with their star, sub and sub-sub lords</caption>
          <thead>
            <tr className="border-b border-border">
              {(["House", "Cusp", "Nakshatra", "Star", "Sub", "Sub-sub"] as const).map((heading) => (
                <th
                  className={
                    heading === "Nakshatra"
                      ? "hidden py-2 pr-1.5 caption uppercase text-foreground-muted @lg:table-cell"
                      : "py-2 pr-1.5 caption uppercase text-foreground-muted"
                  }
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.cusps.map((cusp) => (
              <tr className="border-b border-border last:border-0" key={cusp.house}>
                <th className="py-1.5 pr-1.5 body-sm font-semibold text-foreground" scope="row">
                  {cusp.house}
                </th>
                <td className="py-1.5 pr-1.5 body-sm tabular-nums text-foreground-secondary">
                  {cusp.sign.slice(0, 3)} {degrees(cusp.degreeInSign)}
                </td>
                <td className="hidden py-1.5 pr-1.5 body-sm text-foreground-secondary @lg:table-cell">
                  {cusp.lords.nakshatra}
                </td>
                <td className="py-1.5 pr-1.5 body-sm text-foreground-secondary">
                  <Lord planet={cusp.lords.starLord} />
                </td>
                <td className="py-1.5 pr-1.5 body-sm font-semibold text-foreground">
                  <Lord planet={cusp.lords.subLord} />
                </td>
                <td className="py-1.5 body-sm text-foreground-secondary">
                  <Lord planet={cusp.lords.subSubLord} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <NakshatraNadiTable chart={chart} significators={significators} />

      <section className="grid gap-2">
        <h3 className="body-sm font-semibold text-foreground">Planets, in Bhava Chalit houses</h3>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Planetary positions with their KP lords and their house by Placidus cusp
          </caption>
          <thead>
            <tr className="border-b border-border">
              {(["Planet", "Position", "House", "Star", "Sub", "Sub-sub", "Signifies"] as const).map((heading) => (
                <th
                  className={
                    heading === "Signifies"
                      ? "hidden py-2 pr-1.5 caption uppercase text-foreground-muted @lg:table-cell"
                      : "py-2 pr-1.5 caption uppercase text-foreground-muted"
                  }
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.planets.map((planet) => {
              const signifies = significators.get(planet.planet);
              return (
                <tr className="border-b border-border last:border-0" key={planet.planet}>
                  <th className="py-1.5 pr-1.5 body-sm font-semibold text-foreground" scope="row">
                    {planet.planet}
                    {planet.retrograde ? <span className="ml-1 caption text-premium">R</span> : null}
                  </th>
                  <td className="py-1.5 pr-1.5 body-sm tabular-nums text-foreground-secondary">
                    {planet.sign.slice(0, 3)} {degrees(planet.degreeInSign)}
                  </td>
                  <td className="py-1.5 pr-1.5 body-sm tabular-nums text-foreground">
                    {planet.house}
                    {planet.house !== planet.wholeSignHouse ? (
                      <span className="ml-1 caption text-foreground-muted" title="House in the whole-sign Rashi chart">
                        ({planet.wholeSignHouse})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-1.5 body-sm text-foreground-secondary">
                    <Lord planet={planet.lords.starLord} />
                  </td>
                  <td className="py-1.5 pr-1.5 body-sm font-semibold text-foreground">
                    <Lord planet={planet.lords.subLord} />
                  </td>
                  <td className="py-1.5 pr-1.5 body-sm text-foreground-secondary">
                    <Lord planet={planet.lords.subSubLord} />
                  </td>
                  <td className="hidden py-1.5 body-sm tabular-nums text-foreground-secondary @lg:table-cell">
                    {signifies?.ownHouses.join(", ") ?? "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {moved > 0 ? (
          <p className="caption text-foreground-muted">
            {moved} of {chart.planets.length} planets fall in a different house here than in the Rashi chart. The
            Rashi house is shown in brackets. Both are correct: they are different house systems, and KP is defined
            on this one.
          </p>
        ) : null}
      </section>

      <NodeAgency significators={[significators.get("Rahu"), significators.get("Ketu")]} />

      <p className="caption text-foreground-muted">
        Houses are Placidus (Bhava Chalit). Lords are abbreviated: Su Sun, Mo Moon, Ma Mars, Me Mercury, Ju Jupiter,
        Ve Venus, Sa Saturn, Ra Rahu, Ke Ketu.
      </p>
    </div>
  );
}

/**
 * The Nakshatra Nadi view condenses KP's three relevant readings into one
 * scannable line: the planet itself, its star lord, and its sub lord. Each
 * entry carries the houses it signifies, as practitioners conventionally read
 * it (for example, `SUN-3,5`).
 */
function NakshatraNadiTable({
  chart,
  significators,
}: {
  chart: KpChart;
  significators: ReadonlyMap<string, PlanetSignificators>;
}) {
  const houseLabel = (planet: string) => {
    // The planet's own houses, not its full significations. Each column here
    // names a different planet, and the star lord's houses belong in the star
    // lord's column - folding them into the first one prints them twice and
    // makes every entry look wider than it is.
    const houses = significators.get(planet)?.ownHouses ?? [];
    return `${planet.toUpperCase()}-${houses.length > 0 ? houses.join(",") : "—"}`;
  };

  return (
    <section className="grid gap-2">
      <div>
        <h3 className="body-sm font-semibold text-foreground">Nakshatra Nadi</h3>
        <p className="caption text-foreground-muted">
          Planet, star lord and sub lord with the houses each signifies in its own right.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <caption className="sr-only">
            Nakshatra Nadi house significators for each planet, its star lord, and its sub lord
          </caption>
          <thead className="bg-premium text-background">
            <tr>
              {(["Planet", "Star Lord", "Sub Lord"] as const).map((heading) => (
                <th className="border-r border-background/25 px-3 py-2.5 text-sm font-semibold last:border-r-0 sm:px-4" key={heading} scope="col">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.planets.map((planet) => (
              <tr className="border-t border-border transition-colors hover:bg-surface-raised" key={planet.planet}>
                <th className="border-r border-border px-3 py-2.5 font-medium text-foreground sm:px-4" scope="row">
                  {houseLabel(planet.planet)}
                </th>
                <td className="border-r border-border px-3 py-2.5 text-foreground-secondary sm:px-4">
                  {houseLabel(planet.lords.starLord)}
                </td>
                <td className="px-3 py-2.5 text-foreground-secondary sm:px-4">
                  {houseLabel(planet.lords.subLord)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const RELATION_LABEL = {
  conjunct: "conjoined with",
  "aspected-by": "aspected by",
  "sign-lord": "in the sign of",
} as const;

/**
 * What the nodes are acting for.
 *
 * Rahu and Ketu rule no sign, so KP treats them as agents for other planets.
 * Showing which planet and by which relation matters: a node's significations
 * are borrowed, and a reader who cannot see where they came from cannot judge
 * how much weight to give them.
 */
function NodeAgency({ significators }: { significators: (PlanetSignificators | undefined)[] }) {
  const nodes = significators.filter((entry): entry is PlanetSignificators => Boolean(entry));
  if (nodes.length === 0) return null;

  return (
    <section className="grid gap-2">
      <h3 className="body-sm font-semibold text-foreground">Rahu and Ketu act for</h3>
      <ul className="grid gap-2">
        {nodes.map((node) => (
          <li className="rounded-md border border-border p-3" key={node.planet}>
            <p className="body-sm font-semibold text-foreground">{node.planet}</p>
            {node.agents.length === 0 ? (
              <p className="mt-1 caption text-foreground-muted">No agent planet, so it speaks only for itself.</p>
            ) : (
              <ul className="mt-1 grid gap-0.5">
                {node.agents.map((agent) => (
                  <li className="caption text-foreground-secondary" key={agent.planet}>
                    {RELATION_LABEL[agent.relation]}{" "}
                    <span
                      className={agent.relation === node.primaryRelation ? "font-semibold text-foreground" : ""}
                    >
                      {agent.planet}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 caption tabular-nums text-foreground-muted">
              Signifies houses <span className="text-foreground">{node.ownHouses.join(", ")}</span>
              {node.houses.length > node.ownHouses.length ? (
                <> &middot; {node.houses.join(", ")} once its star lord is counted too</>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      <p className="caption text-foreground-muted">
        A node gives the results of the planet it is conjoined with, the planet aspecting it, and the lord of the
        sign it occupies. All of them count; the strongest is shown in bold.
      </p>
    </section>
  );
}
