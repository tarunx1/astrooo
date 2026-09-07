import { SIGNS, type PlanetName, type ZodiacSign } from "@/config/astrology";
import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { computeChart, computeChartForBirth, houseOf, type ChartLocation } from "@/lib/astrology/engine/chart";
import { getKpPosition, type KpPosition } from "@/lib/astrology/kp/vimshottari";

/**
 * A chart as Krishnamurti Paddhati requires it.
 *
 * KP differs from the rest of this product in two ways that matter, and both
 * are settled here rather than left to the caller.
 *
 * It uses **Placidus** cusps, not whole-sign houses. A house in KP begins at a
 * calculated cusp somewhere inside a sign, so a planet can sit in one sign and
 * a different house - the Bhava Chalit position. Reading KP off whole-sign
 * houses gets a different answer for any planet near a cusp, which is a large
 * fraction of them.
 *
 * And every cusp has a **sub lord**, which is the single most important value
 * in the system: KP judges a matter by the sub lord of the cusp that governs
 * it. That is why this file exists at all - it was not possible before the
 * engine could compute Placidus cusps itself.
 */

export type KpCusp = {
  /** 1-12. */
  house: number;
  /** Sidereal longitude where the house begins. */
  longitude: number;
  sign: ZodiacSign;
  degreeInSign: number;
  /** Star, sub and sub-sub lord of the cusp itself. */
  lords: KpPosition;
};

export type KpPlanet = {
  planet: PlanetName;
  longitude: number;
  sign: ZodiacSign;
  degreeInSign: number;
  /** 1-12, from the Placidus cusps. This is the Bhava Chalit house. */
  house: number;
  /** The house the whole-sign chart would have put it in. */
  wholeSignHouse: number;
  retrograde: boolean;
  lords: KpPosition;
};

export type KpChart = {
  instant: Date;
  ayanamsa: number;
  cusps: KpCusp[];
  planets: KpPlanet[];
};

/**
 * Builds the KP chart for a moment and place.
 *
 * Placidus is undefined inside the polar circles, so this can throw. That is
 * the engine refusing to invent a cusp rather than a fault here, and KP simply
 * has no answer for a birth above the Arctic Circle.
 */
export function computeKpChart(instant: Date, location: ChartLocation): KpChart {
  const placidus = computeChart(instant, location, "placidus");
  const wholeSign = computeChart(instant, location, "whole-sign");

  const cusps: KpCusp[] = placidus.houseCusps.map((longitude, index) => ({
    house: index + 1,
    longitude,
    sign: SIGNS[Math.floor(normalizeDegrees(longitude) / 30)],
    degreeInSign: normalizeDegrees(longitude) % 30,
    lords: getKpPosition(longitude),
  }));

  const wholeSignHouseOf = new Map(wholeSign.planets.map((planet) => [planet.planet, planet.house]));

  const planets: KpPlanet[] = placidus.planets.map((planet) => ({
    planet: planet.planet,
    longitude: planet.longitude,
    sign: planet.sign,
    degreeInSign: planet.degreeInSign,
    house: houseOf(planet.longitude, placidus.houseCusps),
    wholeSignHouse: wholeSignHouseOf.get(planet.planet) ?? planet.house,
    retrograde: planet.retrograde,
    lords: getKpPosition(planet.longitude),
  }));

  return { instant: placidus.instant, ayanamsa: placidus.ayanamsa, cusps, planets };
}

/** The same, described the way a birth record describes it. */
export function computeKpChartForBirth(
  birth: { dateOfBirth: string; timeOfBirth: string },
  location: ChartLocation,
): KpChart {
  const chart = computeChartForBirth(birth, location, "placidus");
  return computeKpChart(chart.instant, location);
}

/**
 * Which house a longitude falls in, by the Placidus cusps.
 *
 * Exposed so a caller can place something the chart does not already carry -
 * a transiting planet, say - in the same houses as everything else.
 */
export function bhavaHouseOf(longitude: number, cusps: KpCusp[]): number {
  return houseOf(longitude, cusps.map((cusp) => cusp.longitude));
}
