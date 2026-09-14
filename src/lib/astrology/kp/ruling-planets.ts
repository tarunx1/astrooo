import type { PlanetName } from "@/config/astrology";
import { getSignLord } from "@/lib/astrology/kp/vimshottari";
import { getSignNumberFromName } from "@/lib/astrology/charts/signs";
import type { KpChart } from "@/lib/astrology/kp/chart";

/**
 * KP Ruling Planets.
 *
 * The set of lords governing the moment a question is asked - or, for a natal
 * chart, the moment of birth. Krishnamurti's rule takes five sources, each
 * contributing the lords of one point:
 *
 *   1. the Ascendant's sign lord, star lord and sub lord
 *   2. the Moon's sign lord, star lord and sub lord
 *   3. the lord of the weekday
 *
 * A planet named by more than one source is stronger for it, so the count is
 * kept rather than collapsed to a set: "Venus appears three times" is the
 * substance of the technique, not an artefact of the list.
 *
 * **This is the five-source form.** Some practitioners add Rahu or Ketu when a
 * node occupies the sign of a ruling planet, and others include the lord of the
 * day's hora. Neither addition is made here - they are elaborations on the base
 * rule and are not universally applied, so adding one silently would hand back a
 * different technique under the same name.
 */

/** Weekday lords, Sunday first, matching `Date.getUTCDay`. */
const WEEKDAY_LORDS: PlanetName[] = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
];

export type RulingPlanetSource =
  | "ascendant-sign-lord"
  | "ascendant-star-lord"
  | "ascendant-sub-lord"
  | "moon-sign-lord"
  | "moon-star-lord"
  | "moon-sub-lord"
  | "day-lord";

export type RulingPlanet = {
  planet: PlanetName;
  /** Every source that named this planet. */
  sources: RulingPlanetSource[];
  /** How many sources named it. Higher is stronger. */
  strength: number;
};

export type RulingPlanetsResult = {
  planets: RulingPlanet[];
  /** The weekday used, for transparency about the boundary. */
  weekday: string;
  dayLord: PlanetName;
};

/**
 * The weekday a moment belongs to.
 *
 * A Vedic day runs sunrise to sunrise rather than midnight to midnight, so a
 * birth between midnight and dawn belongs to the *previous* weekday. That
 * boundary is not applied here: this function takes the civil day, and the
 * caller supplying a pre-dawn birth should be aware the day lord may belong to
 * the day before. Recorded plainly rather than fudged, because silently
 * shifting the day would be a worse surprise than stating the limit.
 */
function weekdayOf(instant: Date): { index: number; name: string } {
  const index = instant.getUTCDay();
  const name = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index];
  return { index, name };
}

export function calculateRulingPlanets(chart: KpChart): RulingPlanetsResult {
  const ascendant = chart.cusps.find((cusp) => cusp.house === 1);
  const moon = chart.planets.find((planet) => planet.planet === "Moon");

  if (!ascendant || !moon) {
    throw new Error("Ruling planets need the ascendant cusp and the Moon.");
  }

  const { index, name } = weekdayOf(chart.instant);
  const dayLord = WEEKDAY_LORDS[index];

  const contributions: Array<{ planet: PlanetName; source: RulingPlanetSource }> = [
    { planet: getSignLord(getSignNumberFromName(ascendant.sign)), source: "ascendant-sign-lord" },
    { planet: ascendant.lords.starLord, source: "ascendant-star-lord" },
    { planet: ascendant.lords.subLord, source: "ascendant-sub-lord" },
    { planet: getSignLord(getSignNumberFromName(moon.sign)), source: "moon-sign-lord" },
    { planet: moon.lords.starLord, source: "moon-star-lord" },
    { planet: moon.lords.subLord, source: "moon-sub-lord" },
    { planet: dayLord, source: "day-lord" },
  ];

  const byPlanet = new Map<PlanetName, RulingPlanetSource[]>();
  for (const { planet, source } of contributions) {
    byPlanet.set(planet, [...(byPlanet.get(planet) ?? []), source]);
  }

  const planets = [...byPlanet.entries()]
    .map(([planet, sources]) => ({ planet, sources, strength: sources.length }))
    // Strongest first; ties by name so the order never depends on insertion.
    .sort((a, b) => b.strength - a.strength || a.planet.localeCompare(b.planet));

  return { planets, weekday: name, dayLord };
}
