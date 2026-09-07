import { OBSERVED_DELTA_T } from "@/lib/astrology/engine/data/delta-t";

/**
 * Time scales.
 *
 * Astronomical theories are evaluated in Terrestrial Time, but a birth is
 * recorded in civil time. The gap between them, delta-T, is not a constant:
 * it is the accumulated difference between the Earth's actual rotation and a
 * uniform clock, and it has to be modelled rather than assumed.
 */

/** Julian Day of 2000 January 1.5 TT, the epoch every series here is built on. */
export const J2000 = 2451545.0;

/** Days in a Julian century and in a Julian millennium. */
export const DAYS_PER_CENTURY = 36525.0;
export const DAYS_PER_MILLENNIUM = 365250.0;

/**
 * Julian Day from a UTC instant.
 *
 * Derived from the epoch milliseconds rather than from calendar fields, so the
 * Gregorian/Julian calendar switch and every leap-year rule are the platform's
 * problem and not a hand-rolled one. The Unix epoch is JD 2440587.5.
 */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** The inverse, for reporting an instant a search converged on. */
export function dateFromJulianDay(jd: number): Date {
  return new Date(Math.round((jd - 2440587.5) * 86400000));
}

/** Julian centuries of TT since J2000. */
export function julianCenturies(jdTT: number): number {
  return (jdTT - J2000) / DAYS_PER_CENTURY;
}

/** Julian millennia of TT since J2000, the argument VSOP87 is expressed in. */
export function julianMillennia(jdTT: number): number {
  return (jdTT - J2000) / DAYS_PER_MILLENNIUM;
}

/** Decimal year, used only to select a delta-T polynomial. */
function decimalYear(jd: number): number {
  const date = dateFromJulianDay(jd);
  const year = date.getUTCFullYear();
  const startOfYear = Date.UTC(year, 0, 1);
  const startOfNext = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - startOfYear) / (startOfNext - startOfYear);
}

function polynomial(t: number, coefficients: number[]): number {
  let result = 0;
  for (let i = coefficients.length - 1; i >= 0; i -= 1) result = result * t + coefficients[i];
  return result;
}

/**
 * Delta-T from the Espenak & Meeus polynomials alone, without the observed
 * table. Kept separate so the table can be anchored against it.
 */
function modelledDeltaT(jd: number): number {
  const year = decimalYear(jd);

  if (year < -500) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (year < 500) {
    const u = year / 100;
    return polynomial(u, [10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521]);
  }
  if (year < 1600) {
    const u = (year - 1000) / 100;
    return polynomial(u, [1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073]);
  }
  if (year < 1700) {
    const t = year - 1600;
    return polynomial(t, [120, -0.9808, -0.01532, 1 / 7129]);
  }
  if (year < 1800) {
    const t = year - 1700;
    return polynomial(t, [8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1174000]);
  }
  if (year < 1860) {
    const t = year - 1800;
    return polynomial(t, [
      13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436, 0.0000121272, -0.0000001699, 0.000000000875,
    ]);
  }
  if (year < 1900) {
    const t = year - 1860;
    return polynomial(t, [7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174]);
  }
  if (year < 1920) {
    const t = year - 1900;
    return polynomial(t, [-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197]);
  }
  if (year < 1941) {
    const t = year - 1920;
    return polynomial(t, [21.2, 0.84493, -0.0761, 0.0020936]);
  }
  if (year < 1961) {
    const t = year - 1950;
    return polynomial(t, [29.07, 0.407, -1 / 233, 1 / 2547]);
  }
  if (year < 1986) {
    const t = year - 1975;
    return polynomial(t, [45.45, 1.067, -1 / 260, -1 / 718]);
  }
  if (year < 2005) {
    const t = year - 2000;
    return polynomial(t, [63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599]);
  }
  if (year < 2050) {
    const t = year - 2000;
    return polynomial(t, [62.92, 0.32217, 0.005589]);
  }
  if (year < 2150) {
    const u = (year - 1820) / 100;
    return -20 + 32 * u * u - 0.5628 * (2150 - year);
  }
  const u = (year - 1820) / 100;
  return -20 + 32 * u * u;
}

/** Terrestrial Time as a Julian Day, from a civil (UTC) instant. */
export function terrestrialTime(date: Date): number {
  const jd = julianDay(date);
  return jd + deltaTSeconds(jd) / 86400;
}

const TABLE_FIRST = OBSERVED_DELTA_T[0];
const TABLE_LAST = OBSERVED_DELTA_T[OBSERVED_DELTA_T.length - 1];

/**
 * The offset between the polynomial and reality at the end of the observed
 * record. Beyond the table the polynomial is shifted by this much, so the
 * engine degrades into a known-biased model rather than stepping several
 * seconds sideways the day the table runs out.
 */
const TRAILING_OFFSET = TABLE_LAST[1] - modelledDeltaT(TABLE_LAST[0] + 2400000.5);

function interpolate(mjd: number): number {
  // Monthly samples over fifty years: a binary search, not a scan.
  let low = 0;
  let high = OBSERVED_DELTA_T.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (OBSERVED_DELTA_T[middle][0] <= mjd) low = middle;
    else high = middle;
  }
  const [mjdLow, valueLow] = OBSERVED_DELTA_T[low];
  const [mjdHigh, valueHigh] = OBSERVED_DELTA_T[high];
  const span = mjdHigh - mjdLow;
  return span === 0 ? valueLow : valueLow + ((valueHigh - valueLow) * (mjd - mjdLow)) / span;
}

/**
 * Delta-T in seconds: TT - UT.
 *
 * Measured where it has been measured, modelled where it has not. The Earth's
 * rotation is not predictable from theory, so for 1973 onwards this reads the
 * IERS record rather than a polynomial fitted to it. Before that, and beyond
 * the end of the record, it falls back to Espenak & Meeus (2006).
 *
 * This matters more than its size suggests: delta-T is the largest remaining
 * error in the engine. A second of it moves the Moon about 0.55 arcseconds and
 * everything else far less, against a nakshatra pada spanning 12000
 * arcseconds - so even the fallback is far below anything a reading can
 * resolve, and the table simply removes the question.
 */
export function deltaTSeconds(jd: number): number {
  const mjd = jd - 2400000.5;
  if (mjd < TABLE_FIRST[0]) return modelledDeltaT(jd);
  if (mjd > TABLE_LAST[0]) return modelledDeltaT(jd) + TRAILING_OFFSET;
  return interpolate(mjd);
}
