import { normalizeRadians } from "@/lib/astrology/engine/angles";
import { VSOP87D_EARTH } from "@/lib/astrology/engine/data/vsop87d-earth";
import { VSOP87D_JUPITER } from "@/lib/astrology/engine/data/vsop87d-jupiter";
import { VSOP87D_MARS } from "@/lib/astrology/engine/data/vsop87d-mars";
import { VSOP87D_MERCURY } from "@/lib/astrology/engine/data/vsop87d-mercury";
import { VSOP87D_SATURN } from "@/lib/astrology/engine/data/vsop87d-saturn";
import { VSOP87D_VENUS } from "@/lib/astrology/engine/data/vsop87d-venus";
import { julianMillennia } from "@/lib/astrology/engine/time";

/**
 * VSOP87D: heliocentric positions of the planets.
 *
 * The theory is a sum of periodic terms per power of tau, the time in Julian
 * millennia from J2000. Coefficients are the published Bureau des Longitudes
 * tables, generated into data files by scripts/astronomy/build-vsop87.ts.
 *
 * Results are referred to the mean ecliptic and equinox of the date, which is
 * why nothing here applies precession: it is already built into the series.
 */
export type VsopBody = "earth" | "mercury" | "venus" | "mars" | "jupiter" | "saturn";

type Series = { readonly L: readonly (readonly number[])[]; readonly B: readonly (readonly number[])[]; readonly R: readonly (readonly number[])[] };

const SERIES: Record<VsopBody, Series> = {
  earth: VSOP87D_EARTH,
  mercury: VSOP87D_MERCURY,
  venus: VSOP87D_VENUS,
  mars: VSOP87D_MARS,
  jupiter: VSOP87D_JUPITER,
  saturn: VSOP87D_SATURN,
};

/** Heliocentric spherical coordinates: longitude and latitude in radians, radius in AU. */
export type Heliocentric = { longitude: number; latitude: number; radius: number };

/** Sums one variable's series: sum over powers of tau of sum of A cos(B + C tau). */
function evaluate(powers: readonly (readonly number[])[], tau: number): number {
  let total = 0;
  // Horner over the powers of tau, so tau is never raised to a large power.
  for (let power = powers.length - 1; power >= 0; power -= 1) {
    const flat = powers[power];
    let sum = 0;
    for (let i = 0; i < flat.length; i += 3) {
      sum += flat[i] * Math.cos(flat[i + 1] + flat[i + 2] * tau);
    }
    total = total * tau + sum;
  }
  return total;
}

export function heliocentric(body: VsopBody, jdTT: number): Heliocentric {
  const tau = julianMillennia(jdTT);
  const series = SERIES[body];

  return {
    longitude: normalizeRadians(evaluate(series.L, tau)),
    latitude: evaluate(series.B, tau),
    radius: evaluate(series.R, tau),
  };
}

/** Rectangular heliocentric coordinates in AU, on the ecliptic of the date. */
export function heliocentricRectangular(body: VsopBody, jdTT: number): { x: number; y: number; z: number } {
  const { longitude, latitude, radius } = heliocentric(body, jdTT);
  const cosLatitude = Math.cos(latitude);
  return {
    x: radius * cosLatitude * Math.cos(longitude),
    y: radius * cosLatitude * Math.sin(longitude),
    z: radius * Math.sin(latitude),
  };
}
