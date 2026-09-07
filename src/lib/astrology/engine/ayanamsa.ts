import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { julianCenturies } from "@/lib/astrology/engine/time";

/**
 * The ayanamsa: the gap between the tropical and sidereal zodiacs.
 *
 * Western astrology measures from the equinox, which drifts. Vedic astrology
 * measures from a fixed point among the stars. The angle between the two grows
 * by about 50 arcseconds a year, and subtracting it is the single step that
 * turns an astronomical longitude into a Vedic one.
 *
 * This is a convention, not an astronomical fact: several definitions are in
 * use and they disagree by arcminutes. This product uses Lahiri throughout,
 * which is what the Indian government's Rashtriya Panchang uses and what every
 * calculation stored so far has been computed with.
 */

/**
 * Lahiri (Chitrapaksha) ayanamsa at J2000, degrees: 23 deg 51' 11.6".
 *
 * Cross-checked rather than taken on faith. Carried forward with the
 * precession term below it predicts 23.8799 deg for 2001-11-27, and the value
 * implied by seven independently calculated planets in a stored chart is
 * 23.8794 deg - agreement to under two arcseconds between two sources that
 * share nothing.
 */
const LAHIRI_AT_J2000 = 23 + 51 / 60 + 11.6 / 3600;

/**
 * General precession in longitude accumulated since J2000, in degrees.
 *
 * The same quantity that rotates a J2000 position onto the ecliptic of date,
 * which is what makes this consistent with the rest of the engine: the
 * ayanamsa is precisely the distance the equinox has slid along the ecliptic.
 */
function precessionSinceJ2000(jdTT: number): number {
  const t = julianCenturies(jdTT);
  return (5029.0966 * t + 1.11113 * t * t - 0.000006 * t * t * t) / 3600;
}

/** Lahiri ayanamsa in degrees at the given instant. */
export function lahiriAyanamsa(jdTT: number): number {
  return LAHIRI_AT_J2000 + precessionSinceJ2000(jdTT);
}

/** Converts a tropical longitude to sidereal, both in degrees. */
export function toSidereal(tropicalLongitude: number, jdTT: number): number {
  return normalizeDegrees(tropicalLongitude - lahiriAyanamsa(jdTT));
}
