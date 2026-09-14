import type { PlanetName } from "@/config/astrology";
import { normalizeSign } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Graha drishti: which planets look at which.
 *
 * Vedic aspects are counted in whole signs, not in degrees. Every planet
 * aspects the seventh from itself; Mars, Jupiter and Saturn each have two
 * further aspects of their own. That is the entire rule, and it is why this is
 * a table rather than an orb calculation - a Vedic aspect either lands on a
 * sign or it does not, with no partial case to interpolate.
 *
 * The nodes cast none. Rahu and Ketu own no sign and the tradition reads what
 * aspects *them* rather than what they aspect. Some later authors give the
 * nodes aspects of their own; that is a choice, not the classical rule, so it
 * is not made here.
 *
 * This is the single definition. `kp/significators.ts` reads it too, so the KP
 * view and the Parashari view can never disagree about who aspects whom.
 */

/** The seventh from a planet, as an offset in signs. Every planet has it. */
const OPPOSITION_OFFSET = 6;

/**
 * Extra aspects, as offsets in signs from the planet's own sign.
 *
 * Written as offsets rather than house numbers: Mars' 4th and 8th aspects are
 * offsets 3 and 7, and mixing the two conventions is the classic way this table
 * gets entered wrong.
 */
const SPECIAL_ASPECT_OFFSETS: Partial<Record<PlanetName, number[]>> = {
  Mars: [3, 7], // the 4th and 8th
  Jupiter: [4, 8], // the 5th and 9th
  Saturn: [2, 9], // the 3rd and 10th
};

/** Houses a planet aspects, counted inclusively from its own sign. */
export function aspectHousesFor(planet: PlanetName): number[] {
  if (planet === "Rahu" || planet === "Ketu") return [];
  return [OPPOSITION_OFFSET, ...(SPECIAL_ASPECT_OFFSETS[planet] ?? [])]
    .map((offset) => offset + 1)
    .sort((a, b) => a - b);
}

/** Sign offsets a planet aspects. */
export function aspectOffsetsFor(planet: PlanetName): number[] {
  if (planet === "Rahu" || planet === "Ketu") return [];
  return [OPPOSITION_OFFSET, ...(SPECIAL_ASPECT_OFFSETS[planet] ?? [])];
}

/** Whether a planet in `fromSign` casts an aspect onto `targetSign`. */
export function aspectsSign(planet: PlanetName, fromSign: number, targetSign: number): boolean {
  const target = normalizeSign(targetSign);
  return aspectOffsetsFor(planet).some(
    (offset) => normalizeSign(normalizeSign(fromSign) + offset) === target,
  );
}

export type PlanetAspect = {
  from: PlanetName;
  to: PlanetName;
  /** Which aspect it is, counted inclusively: 7 for the opposition. */
  house: number;
};

export type HouseAspect = {
  from: PlanetName;
  /** House number counted from the ascendant, 1-12. */
  house: number;
  aspectHouse: number;
};

/**
 * Every aspect in a chart, planet to planet and planet to house.
 *
 * Houses are whole-sign, matching the chart's own house system, so the house a
 * planet aspects is the sign it aspects counted from the ascendant. A different
 * house system would need cusps and would answer a different question; mixing
 * the two is how a Bhava Chalit house ends up labelled as a Rashi one.
 */
export function calculateAspects(chart: VedicChartData): {
  planets: PlanetAspect[];
  houses: HouseAspect[];
} {
  const ascendant = normalizeSign(chart.ascendantSign);
  const planetAspects: PlanetAspect[] = [];
  const houseAspects: HouseAspect[] = [];

  for (const planet of chart.planets) {
    const from = normalizeSign(planet.sign);

    for (const offset of aspectOffsetsFor(planet.planet)) {
      const targetSign = normalizeSign(from + offset);
      const house = ((targetSign - ascendant + 12) % 12) + 1;

      houseAspects.push({ from: planet.planet, house, aspectHouse: offset + 1 });

      for (const other of chart.planets) {
        if (other.planet === planet.planet) continue;
        if (normalizeSign(other.sign) !== targetSign) continue;
        planetAspects.push({ from: planet.planet, to: other.planet, house: offset + 1 });
      }
    }
  }

  return { planets: planetAspects, houses: houseAspects };
}

/**
 * Graded drishti, in virupas.
 *
 * Parashara does not treat every aspect as equal. Counted by house distance, an
 * aspect lands at a quarter, a half, three quarters or in full, and the special
 * aspects of Mars, Jupiter and Saturn are full where an ordinary planet's would
 * be partial - which is exactly what makes them special.
 *
 * Sixty virupas is a full aspect.
 *
 * **The house table is what is implemented.** Parashara also gives a
 * degree-based interpolation that grades an aspect continuously between houses;
 * that formula has variant readings and is not applied here. An aspect lands on
 * a whole sign, at one of the four strengths below.
 */
export const FULL_DRISHTI = 60;

const GRADED_BY_HOUSE: Record<number, number> = {
  3: 15,
  10: 15,
  5: 30,
  9: 30,
  4: 45,
  8: 45,
  7: FULL_DRISHTI,
};

/** Houses where a planet's own special aspect overrides the graded value. */
const SPECIAL_FULL: Partial<Record<PlanetName, number[]>> = {
  Mars: [4, 8],
  Jupiter: [5, 9],
  Saturn: [3, 10],
};

/**
 * Virupas a planet casts onto a sign, 0 when it does not aspect it at all.
 *
 * The nodes cast nothing, so they always return 0.
 */
export function drishtiStrength(planet: PlanetName, fromSign: number, targetSign: number): number {
  if (planet === "Rahu" || planet === "Ketu") return 0;

  const house = ((normalizeSign(targetSign) - normalizeSign(fromSign) + 12) % 12) + 1;

  if (SPECIAL_FULL[planet]?.includes(house)) return FULL_DRISHTI;
  return GRADED_BY_HOUSE[house] ?? 0;
}
