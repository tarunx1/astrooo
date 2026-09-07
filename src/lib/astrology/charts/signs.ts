import { SIGNS, type ZodiacSign } from "@/config/astrology";
import { ChartDataError } from "@/lib/astrology/charts/types";

/**
 * Longitude and sign arithmetic, defined once.
 *
 * Every part of the chart engine derives signs and degrees through these, so
 * there is one boundary convention rather than a slightly different rounding
 * rule in each caller.
 */
export const DEGREES_PER_SIGN = 30;
export const SIGNS_IN_ZODIAC = 12;

/**
 * Brings any longitude into 0 <= value < 360.
 *
 * Providers and derived calculations both produce values outside that range -
 * a subtraction can go negative, an addition past 360 - so normalising is the
 * first thing every helper does rather than something callers must remember.
 */
export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) {
    throw new ChartDataError("Longitude must be a finite number.");
  }

  const wrapped = longitude % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Sign 1-12 containing a longitude. Aries is 1. */
export function getSignNumber(longitude: number): number {
  return Math.floor(normalizeLongitude(longitude) / DEGREES_PER_SIGN) + 1;
}

/** Position within its sign, 0 <= degree < 30. */
export function getDegreeInSign(longitude: number): number {
  return normalizeLongitude(longitude) % DEGREES_PER_SIGN;
}

/** Wraps a sign number into 1-12, so sign arithmetic can be written plainly. */
export function normalizeSign(sign: number): number {
  if (!Number.isInteger(sign)) {
    throw new ChartDataError("Sign must be a whole number.");
  }

  const wrapped = (sign - 1) % SIGNS_IN_ZODIAC;
  return (wrapped < 0 ? wrapped + SIGNS_IN_ZODIAC : wrapped) + 1;
}

export function getSignName(sign: number): ZodiacSign {
  return SIGNS[normalizeSign(sign) - 1];
}

export function getSignNumberFromName(name: string): number {
  const index = SIGNS.findIndex((sign) => sign.toLowerCase() === name.trim().toLowerCase());
  if (index === -1) throw new ChartDataError(`Unknown zodiac sign: ${name}`);
  return index + 1;
}

/**
 * Degrees and arc-minutes, as charts are traditionally labelled.
 *
 * Truncates rather than rounds: rounding 29°59.7' would print 30°00', which
 * reads as the next sign and is the one error worth avoiding here.
 */
export function formatDegreeInSign(degreeInSign: number): string {
  const clamped = Math.max(0, Math.min(DEGREES_PER_SIGN - 1e-9, degreeInSign));
  const degrees = Math.floor(clamped);
  const minutes = Math.floor((clamped - degrees) * 60);

  return `${String(degrees).padStart(2, "0")}°${String(minutes).padStart(2, "0")}'`;
}
