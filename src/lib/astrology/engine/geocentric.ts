import { ARCSEC, DEG, normalizeRadians, toDegrees } from "@/lib/astrology/engine/angles";
import { nutation } from "@/lib/astrology/engine/nutation";
import { julianCenturies } from "@/lib/astrology/engine/time";
import { heliocentric, heliocentricRectangular, type VsopBody } from "@/lib/astrology/engine/vsop87";

/**
 * From heliocentric theory to what an observer on Earth would actually see.
 *
 * Three corrections separate the two, and each is applied here rather than
 * absorbed into a fudge factor:
 *
 *   light-time  the planet is seen where it was when the light left it
 *   aberration  the Earth's own motion tilts the apparent direction
 *   nutation    the reference frame itself wobbles
 *
 * The result is an apparent geocentric position referred to the true equinox
 * and ecliptic of the date, which is the quantity every ephemeris and every
 * ayanamsa definition is expressed against.
 */

/** Days light takes to cross one astronomical unit. */
const LIGHT_TIME_PER_AU = 0.0057755183;

/** Constant of aberration, arcseconds. */
const ABERRATION_CONSTANT = 20.49552;

export type ApparentPosition = {
  /** Apparent geocentric ecliptic longitude, degrees in [0, 360). */
  longitude: number;
  /** Apparent geocentric ecliptic latitude, degrees. */
  latitude: number;
  /** Distance from the Earth in AU. */
  distance: number;
};

/** Bodies this module can place. The Moon has its own theory and its own module. */
export type EphemerisBody = "sun" | Exclude<VsopBody, "earth">;

/**
 * VSOP87 is expressed in its own dynamical reference frame. This rotates a
 * position into FK5, which is what catalogues and ephemerides use. Worth about
 * a tenth of an arcsecond - negligible for a reading, but free, and leaving it
 * out would show up as a constant bias against every reference we test on.
 */
function fk5Correction(
  longitude: number,
  latitude: number,
  jdTT: number,
): { longitude: number; latitude: number } {
  const t = julianCenturies(jdTT);
  const lPrime = longitude - (1.397 * t + 0.00031 * t * t) * DEG;
  const deltaLongitude = (-0.09033 + 0.03916 * (Math.cos(lPrime) + Math.sin(lPrime)) * Math.tan(latitude)) * ARCSEC;
  const deltaLatitude = 0.03916 * (Math.cos(lPrime) - Math.sin(lPrime)) * ARCSEC;
  return { longitude: longitude + deltaLongitude, latitude: latitude + deltaLatitude };
}

/**
 * Annual aberration, Meeus chapter 23's rigorous form. Uses the Earth's orbit
 * rather than a circular approximation, so it stays correct near perihelion.
 */
function aberration(
  longitude: number,
  latitude: number,
  sunLongitude: number,
  jdTT: number,
): { longitude: number; latitude: number } {
  const t = julianCenturies(jdTT);
  const eccentricity = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const perihelion = (102.93735 + 1.71946 * t + 0.00046 * t * t) * DEG;
  const kappa = ABERRATION_CONSTANT * ARCSEC;

  const deltaLongitude =
    (-kappa * Math.cos(sunLongitude - longitude) +
      eccentricity * kappa * Math.cos(perihelion - longitude)) /
    Math.cos(latitude);

  const deltaLatitude =
    -kappa *
    Math.sin(latitude) *
    (Math.sin(sunLongitude - longitude) - eccentricity * Math.sin(perihelion - longitude));

  return { longitude: longitude + deltaLongitude, latitude: latitude + deltaLatitude };
}

/** The Sun's geometric geocentric longitude, radians. Needed by the aberration term. */
function sunGeometricLongitude(jdTT: number): number {
  return normalizeRadians(heliocentric("earth", jdTT).longitude + Math.PI);
}

/**
 * Apparent geocentric position of the Sun or a planet.
 *
 * The Sun needs no light-time iteration: in a heliocentric frame it sits at
 * the origin, so the whole effect of the finite speed of light on its
 * direction is the aberration term.
 */
export function apparentPosition(body: EphemerisBody, jdTT: number): ApparentPosition {
  let longitude: number;
  let latitude: number;
  let distance: number;

  if (body === "sun") {
    const earth = heliocentric("earth", jdTT);
    longitude = normalizeRadians(earth.longitude + Math.PI);
    latitude = -earth.latitude;
    distance = earth.radius;
  } else {
    const earth = heliocentricRectangular("earth", jdTT);

    // Light-time: solve for the moment the light we see now left the planet.
    // Two iterations settle this to well under a milliarcsecond; the loop
    // guards against a slow case rather than expecting one.
    let lightTime = 0;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const planet = heliocentricRectangular(body, jdTT - lightTime);
      x = planet.x - earth.x;
      y = planet.y - earth.y;
      z = planet.z - earth.z;
      const range = Math.sqrt(x * x + y * y + z * z);
      const next = LIGHT_TIME_PER_AU * range;
      if (Math.abs(next - lightTime) < 1e-12) {
        lightTime = next;
        break;
      }
      lightTime = next;
    }

    longitude = normalizeRadians(Math.atan2(y, x));
    latitude = Math.atan2(z, Math.sqrt(x * x + y * y));
    distance = Math.sqrt(x * x + y * y + z * z);
  }

  const fk5 = fk5Correction(longitude, latitude, jdTT);
  const aberrated = aberration(fk5.longitude, fk5.latitude, sunGeometricLongitude(jdTT), jdTT);

  return {
    longitude: toDegrees(normalizeRadians(aberrated.longitude + nutation(jdTT).longitude)),
    latitude: toDegrees(aberrated.latitude),
    distance,
  };
}
