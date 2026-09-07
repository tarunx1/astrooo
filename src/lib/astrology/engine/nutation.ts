import { ARCSEC, DEG, normalizeRadians } from "@/lib/astrology/engine/angles";
import { julianCenturies } from "@/lib/astrology/engine/time";

/**
 * Nutation and the obliquity of the ecliptic.
 *
 * Nutation is the short-period wobble of the Earth's axis, worth at most about
 * 17 arcseconds in longitude. It is included because an apparent position is
 * what an observer would actually measure, and because leaving it out would
 * put us a predictable few arcseconds away from every reference we check
 * against - a discrepancy that would look like a bug forever after.
 */
export type Nutation = {
  /** Nutation in longitude, radians. */
  longitude: number;
  /** Nutation in obliquity, radians. */
  obliquity: number;
};

/**
 * Meeus, Astronomical Algorithms, chapter 22, abridged series.
 *
 * Accurate to about 0.5 arcseconds in longitude and 0.1 in obliquity, against
 * a full IAU 1980 series of 106 terms. Both figures are far below anything
 * this product can resolve, and the residual is measured against JPL Horizons
 * in the engine's tests rather than assumed.
 */
export function nutation(jdTT: number): Nutation {
  const t = julianCenturies(jdTT);

  // Longitude of the ascending node of the Moon's mean orbit.
  const omega = normalizeRadians((125.04452 - 1934.136261 * t) * DEG);
  // Mean longitudes of the Sun and the Moon.
  const sunLongitude = normalizeRadians((280.4665 + 36000.7698 * t) * DEG);
  const moonLongitude = normalizeRadians((218.3165 + 481267.8813 * t) * DEG);

  const longitude =
    (-17.2 * Math.sin(omega) -
      1.32 * Math.sin(2 * sunLongitude) -
      0.23 * Math.sin(2 * moonLongitude) +
      0.21 * Math.sin(2 * omega)) *
    ARCSEC;

  const obliquity =
    (9.2 * Math.cos(omega) +
      0.57 * Math.cos(2 * sunLongitude) +
      0.1 * Math.cos(2 * moonLongitude) -
      0.09 * Math.cos(2 * omega)) *
    ARCSEC;

  return { longitude, obliquity };
}

/**
 * Mean obliquity of the ecliptic, radians. Laskar's expression via Meeus 22.3,
 * good to 0.01 arcsecond across roughly 1000-3000.
 */
export function meanObliquity(jdTT: number): number {
  const u = julianCenturies(jdTT) / 100;
  const arcseconds =
    21.448 -
    u *
      (4680.93 +
        u *
          (1.55 -
            u *
              (1999.25 -
                u * (51.38 + u * (249.67 + u * (39.05 - u * (7.12 - u * (27.87 + u * (5.79 + u * 2.45)))))))));
  return (23 + 26 / 60) * DEG + arcseconds * ARCSEC;
}

/** True obliquity: mean obliquity plus the nutation in obliquity. */
export function trueObliquity(jdTT: number): number {
  return meanObliquity(jdTT) + nutation(jdTT).obliquity;
}
