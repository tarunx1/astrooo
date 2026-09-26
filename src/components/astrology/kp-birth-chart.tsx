import { useId } from "react";
import { NorthIndianChart } from "@/components/astrology/north-indian-chart";
import { createKpChartDisplay } from "@/lib/astrology/charts/kp";
import { formatDegreeInSign, getSignName } from "@/lib/astrology/charts/signs";
import { HouseSystemUnavailableError } from "@/lib/astrology/engine/houses";
import { computeKpChartForBirth } from "@/lib/astrology/kp/chart";
import type { KundliResult } from "@/lib/kundli/types";

/** Server-rendered slot: the chart selector receives no birth inputs or engine. */
export function KpBirthChart({ result }: { result: KundliResult }) {
  const titleId = useId();
  let display: ReturnType<typeof createKpChartDisplay>;
  try {
    display = createKpChartDisplay(computeKpChartForBirth(
      { dateOfBirth: result.person.dateOfBirth, timeOfBirth: result.person.timeOfBirth },
      {
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        timezone: result.location.timezone,
      },
    ));
  } catch (error) {
    if (!(error instanceof HouseSystemUnavailableError)) throw error;
    return (
      <p className="body-sm text-foreground-secondary" role="status">
        KP is unavailable for this birth place because Placidus house cusps cannot be calculated inside the polar circles.
      </p>
    );
  }

  return (
    <figure className="grid gap-3">
      <span className="sr-only" id={titleId}>KP birth chart: Placidus houses</span>
      <div className="mx-auto w-full max-w-md">
        <NorthIndianChart data={display.data} houses={display.houses} showDegrees titleId={titleId} />
      </div>
      <ul className="sr-only">
        {display.houses.map((house) => (
          <li key={house.house}>
            House {house.house}, cusp in {house.signName}:{" "}
            {house.planets.length === 0 ? "no planets" : house.planets.map((planet) =>
              `${planet.planet} in ${getSignName(planet.sign)} at ${formatDegreeInSign(planet.degreeInSign)}${planet.retrograde ? " retrograde" : ""}`,
            ).join(", ")}
          </li>
        ))}
      </ul>
      <figcaption className="caption text-center text-foreground-muted">
        KP · Placidus houses · North Indian style. Gold numbers show cusp signs; planets occupy their KP houses.
        Degrees remain within each planet’s zodiac sign. Uses the same birth calculation as the KP tables.
      </figcaption>
    </figure>
  );
}
