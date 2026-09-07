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
 * use and they disagree by arcminutes. Lahiri is the default throughout, which
 * is what the Indian government's Rashtriya Panchang uses and what every
 * calculation stored so far has been computed with.
 *
 * The choice is named rather than assumed because Krishnamurti Paddhati is
 * traditionally worked in its own ayanamsa, which differs from Lahiri by a few
 * arcminutes. That sounds negligible and is not: a KP sub-sub division spans
 * about 10 arcminutes, so a shift of that size changes sub-sub lords routinely
 * and sub lords occasionally.
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

/**
 * The ayanamsa definitions this engine can compute.
 *
 * Only Lahiri is here. The Krishnamurti ayanamsa that KP is traditionally
 * worked in is deliberately absent: its anchor is a published constant this
 * engine has no verified source for, and guessing one would silently move
 * every KP sub lord. Adding it is a matter of supplying that one number - see
 * AYANAMSA_ANCHORS below - not of new machinery.
 */
export type AyanamsaName = "lahiri";

/**
 * Each definition is one anchor value plus the same precession term. That is
 * all an ayanamsa is: a starting offset and the rate the equinox slides.
 */
export const AYANAMSA_ANCHORS: Record<AyanamsaName, { atJ2000: number; label: string }> = {
  lahiri: { atJ2000: LAHIRI_AT_J2000, label: "Lahiri (Chitrapaksha)" },
};

/** Ayanamsa in degrees at an instant, for a named definition. */
export function ayanamsaFor(jdTT: number, name: AyanamsaName = "lahiri"): number {
  return AYANAMSA_ANCHORS[name].atJ2000 + precessionSinceJ2000(jdTT);
}

/** Converts a tropical longitude to sidereal, both in degrees. */
export function toSidereal(tropicalLongitude: number, jdTT: number, name: AyanamsaName = "lahiri"): number {
  return normalizeDegrees(tropicalLongitude - ayanamsaFor(jdTT, name));
}
