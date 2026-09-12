import {
  DEGREES_PER_SIGN,
  getDegreeInSign,
  getSignNumber,
  normalizeSign,
} from "@/lib/astrology/charts/signs";

/**
 * Navamsa (D9).
 *
 * Each sign divides into nine parts of 3°20'. Where that sequence begins
 * depends on the sign's quality, which is the whole rule:
 *
 *   movable (Aries, Cancer, Libra, Capricorn) - starts from the sign itself
 *   fixed   (Taurus, Leo, Scorpio, Aquarius)  - starts from the 9th from it
 *   dual    (Gemini, Virgo, Sagittarius, Pisces) - starts from the 5th from it
 *
 * Derived from the longitude, never from the D1 house number: the house is a
 * function of the ascendant, while the navamsa is a property of where the
 * planet actually is, and using the house would make every chart's D9 depend
 * on its ascendant.
 */
export const NAVAMSA_COUNT = 9;

/** Exact width of one navamsa: 30/9 = 3°20'. Kept as a ratio to avoid drift. */
export const NAVAMSA_ARC = DEGREES_PER_SIGN / NAVAMSA_COUNT;

/**
 * Which ninth of its sign a longitude falls in, 0-8.
 *
 * The epsilon matters. A boundary such as 3°20' is 3.3333... in binary and a
 * provider may hand over a value a hair under it; without the nudge that
 * planet lands one navamsa early, which is a different sign in the D9.
 */
export function getNavamsaIndex(longitude: number): number {
  const degreeInSign = getDegreeInSign(longitude);
  const raw = degreeInSign / NAVAMSA_ARC;

  // Pull values that are within a rounding error of a boundary onto it.
  const snapped = Math.abs(raw - Math.round(raw)) < 1e-9 ? Math.round(raw) : raw;

  return Math.min(NAVAMSA_COUNT - 1, Math.max(0, Math.floor(snapped)));
}

/**
 * Where a sign's navamsa sequence begins.
 *
 * Sign numbers are 1-12 with Aries at 1, so quality follows from the number
 * modulo 3: movable signs are 1, 4, 7, 10.
 */
export function getNavamsaStartSign(sign: number): number {
  const normalized = normalizeSign(sign);
  const quality = (normalized - 1) % 3;

  if (quality === 0) return normalized; // movable: from itself
  if (quality === 1) return normalizeSign(normalized + 8); // fixed: 9th from it
  return normalizeSign(normalized + 4); // dual: 5th from it
}

/** The navamsa sign for a longitude. */
export function getNavamsaSign(longitude: number): number {
  const sign = getSignNumber(longitude);
  return normalizeSign(getNavamsaStartSign(sign) + getNavamsaIndex(longitude));
}

/**
 * Where a planet sits *within* its navamsa sign, 0 <= degree < 30.
 *
 * A navamsa is 3°20' of the Rashi, and the D9 spreads that arc across a whole
 * sign, so the position inside it is scaled up ninefold. This is exact
 * arithmetic on the same longitude, not an approximation.
 *
 * It exists because the alternative is worse than showing nothing: carrying the
 * Rashi degree into the D9 pairs a degree with a sign it does not belong to,
 * and a reader has no way to tell from the label that the two disagree.
 */
export function getNavamsaDegree(longitude: number): number {
  const withinNavamsa = getDegreeInSign(longitude) - getNavamsaIndex(longitude) * NAVAMSA_ARC;

  // Guards the boundary case the index has already snapped forward, which would
  // otherwise scale a hair of negative rounding error into a visible amount.
  return Math.min(DEGREES_PER_SIGN, Math.max(0, withinNavamsa * NAVAMSA_COUNT));
}
