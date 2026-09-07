import { DEG, normalizeDegrees, toDegrees } from "@/lib/astrology/engine/angles";
import { nutation, trueObliquity } from "@/lib/astrology/engine/nutation";
import { terrestrialTime } from "@/lib/astrology/engine/time";

/**
 * The ascendant, the midheaven, and house cusps.
 *
 * Everything above this point in the engine is the same for everyone alive at
 * a given moment. This is where a birth becomes personal: the houses depend on
 * where on Earth the observer was and which way the sky was turned, so a
 * minute of time or a degree of latitude changes the answer.
 */

/** Which quadrant division to use. */
export type HouseSystem = "placidus" | "porphyry" | "equal" | "whole-sign";

export type Houses = {
  system: HouseSystem;
  /** Tropical ecliptic longitude of each of the twelve cusps, degrees. Index 0 is the first house. */
  cusps: number[];
  ascendant: number;
  midheaven: number;
};

/**
 * Apparent local sidereal time in degrees.
 *
 * Sidereal time is measured against the stars rather than the Sun, and it is
 * what says which part of the sky is overhead. Meeus chapter 12, from UT
 * rather than TT: this tracks the Earth's actual rotation, so it is the one
 * quantity here that must not use the smooth time scale.
 */
export function localSiderealTime(date: Date, longitudeEast: number): number {
  const jdUT = date.getTime() / 86400000 + 2440587.5;
  const t = (jdUT - 2451545.0) / 36525.0;

  const greenwichMean =
    280.46061837 +
    360.98564736629 * (jdUT - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;

  // The equation of the equinoxes turns mean sidereal time into apparent.
  const jdTT = terrestrialTime(date);
  const equationOfEquinoxes = toDegrees(nutation(jdTT).longitude) * Math.cos(trueObliquity(jdTT));

  return normalizeDegrees(greenwichMean + equationOfEquinoxes + longitudeEast);
}

/** Ecliptic longitude of the midheaven: where the meridian cuts the ecliptic. */
export function midheaven(siderealTime: number, obliquity: number): number {
  const ramc = siderealTime * DEG;
  return normalizeDegrees(toDegrees(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(obliquity))));
}

/** Ecliptic longitude of the ascendant: where the eastern horizon cuts the ecliptic. */
export function ascendant(siderealTime: number, obliquity: number, latitude: number): number {
  const ramc = siderealTime * DEG;
  const phi = latitude * DEG;

  return normalizeDegrees(
    toDegrees(
      Math.atan2(
        Math.cos(ramc),
        -(Math.sin(ramc) * Math.cos(obliquity) + Math.tan(phi) * Math.sin(obliquity)),
      ),
    ),
  );
}

/** Right ascension and declination of a point on the ecliptic. */
function eclipticToEquatorial(longitude: number, obliquity: number): { rightAscension: number; declination: number } {
  const lambda = longitude * DEG;
  return {
    rightAscension: normalizeDegrees(
      toDegrees(Math.atan2(Math.sin(lambda) * Math.cos(obliquity), Math.cos(lambda))),
    ),
    declination: toDegrees(Math.asin(Math.sin(lambda) * Math.sin(obliquity))),
  };
}

/** The ecliptic point at a given right ascension. The inverse of the above, for zero latitude. */
function eclipticLongitudeAtRightAscension(rightAscension: number, obliquity: number): number {
  const alpha = rightAscension * DEG;
  return normalizeDegrees(toDegrees(Math.atan2(Math.sin(alpha), Math.cos(alpha) * Math.cos(obliquity))));
}

/**
 * Thrown when a house system cannot be computed for a location, rather than
 * returning a number that looks like an answer.
 */
export class HouseSystemUnavailableError extends Error {
  constructor(
    message: string,
    readonly system: HouseSystem,
  ) {
    super(message);
    this.name = "HouseSystemUnavailableError";
  }
}

/**
 * Placidus cusps.
 *
 * Placidus divides time, not space: a cusp is where a point has completed a
 * given fraction of its journey from the horizon to the meridian. Because that
 * fraction depends on the declination of the cusp, which depends on the cusp,
 * each one is a fixed point found by iteration.
 *
 * This is the system Krishnamurti Paddhati is defined on, which is why it is
 * here at all: without it there are no honest KP cuspal sub-lords.
 *
 * It has a real limit. Inside the polar circles a degree of the ecliptic may
 * never rise or never set, its semi-arc is undefined, and no amount of
 * iterating produces a cusp. That case throws rather than quietly returning
 * something plausible.
 */
function placidusCusps(siderealTime: number, obliquity: number, latitude: number): number[] {
  const phi = latitude * DEG;

  if (Math.abs(latitude) > 66.5) {
    throw new HouseSystemUnavailableError(
      "Placidus house cusps are undefined inside the polar circles, where parts of the ecliptic never rise or set.",
      "placidus",
    );
  }

  /**
   * Solves one cusp. `offset` places the cusp's right ascension relative to the
   * meridian before the semi-arc term, and `fraction` is how much of the
   * point's own semi-arc separates it from the meridian.
   */
  const solve = (offset: number, fraction: number, nocturnal: boolean): number => {
    let rightAscension = normalizeDegrees(siderealTime + offset);

    for (let iteration = 0; iteration < 100; iteration += 1) {
      const longitude = eclipticLongitudeAtRightAscension(rightAscension, obliquity);
      const { declination } = eclipticToEquatorial(longitude, obliquity);

      const cosSemiArc = -Math.tan(phi) * Math.tan(declination * DEG);
      if (cosSemiArc <= -1 || cosSemiArc >= 1) {
        throw new HouseSystemUnavailableError(
          "Placidus house cusps are undefined here: this degree of the ecliptic never rises or never sets at this latitude.",
          "placidus",
        );
      }

      const semiArc = toDegrees(Math.acos(cosSemiArc));
      const arc = nocturnal ? 180 - semiArc : semiArc;
      const next = normalizeDegrees(siderealTime + offset + fraction * arc);

      const change = Math.abs(((next - rightAscension + 540) % 360) - 180);
      rightAscension = next;
      if (change < 1e-10) break;
    }

    return eclipticLongitudeAtRightAscension(rightAscension, obliquity);
  };

  // Cusp 11 lies a third of its diurnal semi-arc east of the meridian, cusp 12
  // two thirds. Below the horizon the same construction runs from the IC.
  const cusp11 = solve(0, 1 / 3, false);
  const cusp12 = solve(0, 2 / 3, false);
  const cusp2 = solve(60, 2 / 3, false);
  const cusp3 = solve(120, 1 / 3, false);

  const ascendantLongitude = ascendant(siderealTime, obliquity, latitude);
  const midheavenLongitude = midheaven(siderealTime, obliquity);

  const opposite = (value: number) => normalizeDegrees(value + 180);

  return [
    ascendantLongitude,
    cusp2,
    cusp3,
    opposite(midheavenLongitude),
    opposite(cusp11),
    opposite(cusp12),
    opposite(ascendantLongitude),
    opposite(cusp2),
    opposite(cusp3),
    midheavenLongitude,
    cusp11,
    cusp12,
  ];
}

/** Porphyry cusps: each quadrant between the angles is simply cut in three. */
function porphyryCusps(ascendantLongitude: number, midheavenLongitude: number): number[] {
  const imumCoeli = normalizeDegrees(midheavenLongitude + 180);
  const descendant = normalizeDegrees(ascendantLongitude + 180);

  const third = (from: number, to: number, step: number) =>
    normalizeDegrees(from + (normalizeDegrees(to - from) * step) / 3);

  return [
    ascendantLongitude,
    third(ascendantLongitude, imumCoeli, 1),
    third(ascendantLongitude, imumCoeli, 2),
    imumCoeli,
    third(imumCoeli, descendant, 1),
    third(imumCoeli, descendant, 2),
    descendant,
    third(descendant, midheavenLongitude, 1),
    third(descendant, midheavenLongitude, 2),
    midheavenLongitude,
    third(midheavenLongitude, ascendantLongitude, 1),
    third(midheavenLongitude, ascendantLongitude, 2),
  ];
}

/**
 * House cusps for a place and moment, as tropical longitudes.
 *
 * Whole-sign houses, the Vedic default, do not really have cusps: the house is
 * the sign. They are reported here as sign boundaries so that every system
 * returns the same shape, and the first house begins at the start of the
 * ascendant's sign rather than at the ascendant itself.
 */
export function houses(
  date: Date,
  latitude: number,
  longitudeEast: number,
  system: HouseSystem = "whole-sign",
): Houses {
  const jdTT = terrestrialTime(date);
  const obliquity = trueObliquity(jdTT);
  const siderealTime = localSiderealTime(date, longitudeEast);

  const ascendantLongitude = ascendant(siderealTime, obliquity, latitude);
  const midheavenLongitude = midheaven(siderealTime, obliquity);

  let cusps: number[];
  switch (system) {
    case "placidus":
      cusps = placidusCusps(siderealTime, obliquity, latitude);
      break;
    case "porphyry":
      cusps = porphyryCusps(ascendantLongitude, midheavenLongitude);
      break;
    case "equal":
      cusps = Array.from({ length: 12 }, (_, index) => normalizeDegrees(ascendantLongitude + index * 30));
      break;
    case "whole-sign": {
      const signStart = Math.floor(ascendantLongitude / 30) * 30;
      cusps = Array.from({ length: 12 }, (_, index) => normalizeDegrees(signStart + index * 30));
      break;
    }
  }

  return { system, cusps, ascendant: ascendantLongitude, midheaven: midheavenLongitude };
}
