import { NAKSHATRAS, PLANETS, SIGNS, type NakshatraName, type PlanetName, type ZodiacSign } from "@/config/astrology";
import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { lahiriAyanamsa, toSidereal } from "@/lib/astrology/engine/ayanamsa";
import { apparentPosition, type EphemerisBody } from "@/lib/astrology/engine/geocentric";
import { houses, type HouseSystem, type Houses } from "@/lib/astrology/engine/houses";
import { utcInstantOf } from "@/lib/astrology/engine/local-time";
import { moonPosition } from "@/lib/astrology/engine/moon";
import { lunarNodes } from "@/lib/astrology/engine/nodes";
import { terrestrialTime } from "@/lib/astrology/engine/time";
import { getNakshatraName, getPada } from "@/lib/astrology/kp/vimshottari";

/**
 * A complete sidereal chart, assembled from the engine.
 *
 * This is the one place where astronomy becomes astrology: positions are
 * shifted by the ayanamsa, sorted into signs and nakshatras, and placed in
 * houses. Everything above it is physics and everything below it is
 * interpretation.
 */

export type ChartPlanetPosition = {
  planet: PlanetName;
  /** Sidereal ecliptic longitude, degrees in [0, 360). */
  longitude: number;
  /** Ecliptic latitude, degrees. Zero for the nodes, which are points on the ecliptic. */
  latitude: number;
  sign: ZodiacSign;
  degreeInSign: number;
  house: number;
  nakshatra: NakshatraName;
  nakshatraPada: number;
  retrograde: boolean;
  /** Apparent motion in degrees per day. Negative means retrograde. */
  speed: number;
};

export type SiderealChart = {
  /** The moment the chart is drawn for. */
  instant: Date;
  ayanamsa: number;
  ascendant: { longitude: number; sign: ZodiacSign; degreeInSign: number };
  midheaven: number;
  /** Sidereal longitudes of the twelve cusps. */
  houseCusps: number[];
  houseSystem: HouseSystem;
  planets: ChartPlanetPosition[];
};

export type ChartLocation = { latitude: number; longitude: number; timezone: string };

/** Which body supplies each planet's position. The nodes are not bodies. */
const EPHEMERIS_BODY: Partial<Record<PlanetName, EphemerisBody>> = {
  Sun: "sun",
  Mars: "mars",
  Mercury: "mercury",
  Jupiter: "jupiter",
  Venus: "venus",
  Saturn: "saturn",
};

const signOf = (longitude: number): ZodiacSign => SIGNS[Math.floor(normalizeDegrees(longitude) / 30)];

/** Tropical longitude and latitude of a planet, before the ayanamsa is applied. */
function tropicalPosition(planet: PlanetName, jdTT: number): { longitude: number; latitude: number } {
  const body = EPHEMERIS_BODY[planet];
  if (body) return apparentPosition(body, jdTT);
  if (planet === "Moon") return moonPosition(jdTT);

  const { rahu, ketu } = lunarNodes(jdTT);
  // The nodes are defined as points on the ecliptic, so their latitude is zero
  // by construction rather than by measurement.
  return { longitude: planet === "Rahu" ? rahu : ketu, latitude: 0 };
}

/**
 * Apparent motion in degrees per day, by differencing either side of the
 * instant. The sign of this is what retrograde means: a planet is not moving
 * backwards through space, it only appears to from a moving Earth.
 */
function dailyMotion(planet: PlanetName, jdTT: number): number {
  const half = 0.5;
  const before = tropicalPosition(planet, jdTT - half).longitude;
  const after = tropicalPosition(planet, jdTT + half).longitude;
  // Difference across the 360 degree wrap, not through it.
  return ((after - before + 540) % 360) - 180;
}

/**
 * Which house a longitude falls in, given the cusps.
 *
 * Written against the cusps rather than against the signs so that it is
 * correct for every house system. With whole-sign houses it reduces to the
 * sign offset; with Placidus it does not, and that difference is the entire
 * content of a quadrant house system.
 */
export function houseOf(longitude: number, cusps: number[]): number {
  const value = normalizeDegrees(longitude);
  for (let index = 0; index < 12; index += 1) {
    const start = cusps[index];
    const span = normalizeDegrees(cusps[(index + 1) % 12] - start);
    if (normalizeDegrees(value - start) < span) return index + 1;
  }
  // Unreachable while the cusps go once round the zodiac, which is tested.
  return 1;
}

/**
 * Computes a sidereal chart for a moment and a place.
 *
 * Whole-sign houses are the default because that is what Vedic astrology
 * uses and what every chart stored so far was drawn with. Placidus is
 * available for KP, which is defined on it.
 */
export function computeChart(
  instant: Date,
  location: ChartLocation,
  houseSystem: HouseSystem = "whole-sign",
): SiderealChart {
  const jdTT = terrestrialTime(instant);
  const ayanamsa = lahiriAyanamsa(jdTT);

  const tropicalHouses: Houses = houses(instant, location.latitude, location.longitude, houseSystem);
  const ascendantLongitude = toSidereal(tropicalHouses.ascendant, jdTT);

  /**
   * Quadrant cusps are geometry - where the horizon and meridian cut the
   * ecliptic - so shifting them by the ayanamsa just relabels the same points.
   * Sign-based houses are not geometry: they are defined by where the signs
   * begin, and in Vedic astrology the signs are sidereal. Building those from
   * the tropical ascendant and shifting afterwards lands every cusp an
   * ayanamsa short of the sign boundary, which quietly moves planets near a
   * boundary into the wrong house while the chart still looks entirely normal.
   */
  const houseCusps =
    houseSystem === "whole-sign"
      ? Array.from({ length: 12 }, (_, index) =>
          normalizeDegrees(Math.floor(ascendantLongitude / 30) * 30 + index * 30),
        )
      : houseSystem === "equal"
        ? Array.from({ length: 12 }, (_, index) => normalizeDegrees(ascendantLongitude + index * 30))
        : tropicalHouses.cusps.map((cusp) => toSidereal(cusp, jdTT));

  const planets = PLANETS.map((planet) => {
    const tropical = tropicalPosition(planet, jdTT);
    const longitude = toSidereal(tropical.longitude, jdTT);
    const speed = dailyMotion(planet, jdTT);

    return {
      planet,
      longitude,
      latitude: tropical.latitude,
      sign: signOf(longitude),
      degreeInSign: longitude % 30,
      house: houseOf(longitude, houseCusps),
      nakshatra: getNakshatraName(longitude),
      nakshatraPada: getPada(longitude),
      // The Sun and Moon never retrograde; the nodes always do. Both fall out
      // of the measured motion rather than being special-cased.
      retrograde: speed < 0,
      speed,
    } satisfies ChartPlanetPosition;
  });

  return {
    instant,
    ayanamsa,
    ascendant: {
      longitude: ascendantLongitude,
      sign: signOf(ascendantLongitude),
      degreeInSign: ascendantLongitude % 30,
    },
    midheaven: toSidereal(tropicalHouses.midheaven, jdTT),
    houseCusps,
    houseSystem,
    planets,
  };
}

/** Convenience for a chart described the way a birth record describes it. */
export function computeChartForBirth(
  birth: { dateOfBirth: string; timeOfBirth: string },
  location: ChartLocation,
  houseSystem: HouseSystem = "whole-sign",
): SiderealChart {
  return computeChart(utcInstantOf(birth.dateOfBirth, birth.timeOfBirth, location.timezone), location, houseSystem);
}

/** Exported so callers can label a nakshatra without re-deriving the list. */
export const NAKSHATRA_NAMES = NAKSHATRAS;
