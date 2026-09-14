import { normalizeLongitude, normalizeSign } from "@/lib/astrology/charts/signs";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Kaal Sarp: whether every planet is hemmed inside the nodal axis.
 *
 * Rahu and Ketu are always opposite, so they cut the zodiac into two halves.
 * The yoga is present when all seven planets fall in one of those halves - the
 * one running forward from Rahu to Ketu. Nothing about it is a matter of
 * judgement: it either holds or it does not, and this returns which.
 *
 * The arc is measured from Rahu in increasing longitude. Planets sitting in the
 * other half - forward from Ketu to Rahu - are the mirror case, which several
 * authors call Kaal Amrit. It is reported separately rather than folded in,
 * because calling it Kaal Sarp would be answering a different question.
 *
 * A planet exactly on a node is treated as inside the arc. The alternative is
 * to call a chart free of the yoga on a hair of rounding.
 */

const CAUGHT_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;

/**
 * The twelve named forms, by the house Rahu occupies.
 *
 * The names are traditional and index from Rahu's house, so this is a lookup
 * and not a judgement. They are reported only when the yoga is actually
 * present.
 */
const NAMES_BY_RAHU_HOUSE = [
  "Ananta",
  "Kulika",
  "Vasuki",
  "Shankhapal",
  "Padma",
  "Mahapadma",
  "Takshak",
  "Karkotak",
  "Shankhachur",
  "Ghatak",
  "Vishdhar",
  "Sheshnag",
] as const;

export type KaalSarpResult = {
  present: boolean;
  /** True when every planet sits in the Ketu-to-Rahu half instead. */
  mirrored: boolean;
  /** Traditional name, only when the yoga is present. */
  name: string | null;
  /** House Rahu occupies, counted from the ascendant. */
  rahuHouse: number;
  /** Planets outside the Rahu-to-Ketu arc. Empty when the yoga is present. */
  outside: string[];
};

export function calculateKaalSarp(chart: VedicChartData): KaalSarpResult {
  const rahu = chart.planets.find((planet) => planet.planet === "Rahu");
  const ketu = chart.planets.find((planet) => planet.planet === "Ketu");

  if (!rahu || !ketu) {
    throw new ChartDataError("Kaal Sarp needs both Rahu and Ketu.");
  }

  const outside: string[] = [];
  const mirroredOutside: string[] = [];

  for (const name of CAUGHT_PLANETS) {
    const planet = chart.planets.find((entry) => entry.planet === name);
    if (!planet) throw new ChartDataError(`Kaal Sarp needs ${name}'s position.`);

    // Distance travelled forward from Rahu. Anything under 180 is inside the
    // Rahu-to-Ketu half; anything over it is in the mirror half.
    const fromRahu = normalizeLongitude(planet.longitude - rahu.longitude);

    if (fromRahu > 180) outside.push(name);
    if (fromRahu < 180 && fromRahu > 0) mirroredOutside.push(name);
  }

  const rahuHouse =
    ((normalizeSign(rahu.sign) - normalizeSign(chart.ascendantSign) + 12) % 12) + 1;

  const present = outside.length === 0;
  const mirrored = !present && mirroredOutside.length === 0;

  return {
    present,
    mirrored,
    name: present ? NAMES_BY_RAHU_HOUSE[rahuHouse - 1] : null,
    rahuHouse,
    outside,
  };
}
