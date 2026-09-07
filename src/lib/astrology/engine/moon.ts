import { ARCSEC, DEG, normalizeRadians, toDegrees } from "@/lib/astrology/engine/angles";
import { ELP_SERIES } from "@/lib/astrology/engine/data/elp2000-82b";
import { nutation } from "@/lib/astrology/engine/nutation";
import { julianCenturies } from "@/lib/astrology/engine/time";

/**
 * The Moon, from ELP 2000-82B.
 *
 * This is a direct port of the Bureau des Longitudes reference routine
 * elp82b.f, and it is deliberately shaped like that routine rather than
 * tidied: which record layout a series uses, and which power of time scales
 * its amplitude, are decided by the theory's own file numbering. Rewriting
 * that structure into something prettier would make it far harder to check a
 * line here against the published theory, which is the only way anyone can
 * confirm this is right.
 *
 * The Moon needs its own theory because it is not in orbit around the Sun in
 * any sense VSOP87 describes; its motion is dominated by the Earth with the
 * Sun as the principal perturber.
 */

/** Arcseconds in a radian, the theory's working unit. */
const RAD = 648000 / Math.PI;

/** Constants fitted to DE200/LE200, from elp82b.f. */
const ATH = 384747.9806743165;
const A0 = 384747.9806448954;
const AM = 0.074801329518;
const ALFA = 0.002571881335;
const DTASM = (2 * ALFA) / (3 * AM);

/** Mean longitude, mean longitude of perigee, and mean longitude of the node. */
const W = [
  [(218 + 18 / 60 + 59.95571 / 3600) * DEG, 1732559343.73604 / RAD, -5.8883 / RAD, 0.6604e-2 / RAD, -0.3169e-4 / RAD],
  [(83 + 21 / 60 + 11.67475 / 3600) * DEG, 14643420.2632 / RAD, -38.2776 / RAD, -0.45047e-1 / RAD, 0.21301e-3 / RAD],
  [(125 + 2 / 60 + 40.39816 / 3600) * DEG, -6967919.3622 / RAD, 6.3622 / RAD, 0.7625e-2 / RAD, -0.3586e-4 / RAD],
];

const EARTH = [
  (100 + 27 / 60 + 59.22059 / 3600) * DEG,
  129597742.2758 / RAD,
  -0.0202 / RAD,
  0.9e-5 / RAD,
  0.15e-6 / RAD,
];

const PERIHELION = [
  (102 + 56 / 60 + 14.42753 / 3600) * DEG,
  1161.2283 / RAD,
  0.5327 / RAD,
  -0.138e-3 / RAD,
  0,
];

/** General precession in longitude. */
const PRECESSION_RATE = 5029.0966 / RAD;

/** Mean longitudes of the eight planets, and their rates. */
const PLANET_ARGUMENTS: number[][] = [
  [(252 + 15 / 60 + 3.25986 / 3600) * DEG, 538101628.68898 / RAD],
  [(181 + 58 / 60 + 47.28305 / 3600) * DEG, 210664136.43355 / RAD],
  [EARTH[0], EARTH[1]],
  [(355 + 25 / 60 + 59.78866 / 3600) * DEG, 68905077.59284 / RAD],
  [(34 + 21 / 60 + 5.34212 / 3600) * DEG, 10925660.42861 / RAD],
  [(50 + 4 / 60 + 38.89694 / 3600) * DEG, 4399609.65932 / RAD],
  [(314 + 3 / 60 + 18.01841 / 3600) * DEG, 1542481.19393 / RAD],
  [(304 + 20 / 60 + 55.19575 / 3600) * DEG, 786550.32074 / RAD],
];

/** Corrections to the constants, fitting the theory to DE200/LE200. */
const DELNU = 0.55604 / RAD / W[0][1];
const DELE = 0.01789 / RAD;
const DELG = -0.08066 / RAD;
const DELNP = -0.06424 / RAD / W[0][1];
const DELEP = -0.12879 / RAD;

/** Delaunay arguments D, l', l, F, each as a polynomial in T. */
const DEL: number[][] = [0, 1, 2, 3].map(() => new Array<number>(5).fill(0));
for (let i = 0; i < 5; i += 1) {
  DEL[0][i] = W[0][i] - EARTH[i];
  DEL[1][i] = EARTH[i] - PERIHELION[i];
  DEL[2][i] = W[0][i] - W[1][i];
  DEL[3][i] = W[0][i] - W[2][i];
}
DEL[0][0] += Math.PI;

const ZETA = [W[0][0], W[0][1] + PRECESSION_RATE];

/** Which files carry which record layout, mirroring elp82b.f. */
const MAIN_FILES = new Set([1, 2, 3]);
const PLANETARY_FILES = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);

export type MoonPosition = {
  /** Geocentric ecliptic longitude of date, degrees in [0, 360). */
  longitude: number;
  /** Geocentric ecliptic latitude of date, degrees. */
  latitude: number;
  /** Distance from the Earth's centre, kilometres. */
  distance: number;
};

/**
 * Rotation from the ecliptic of date into J2000, from elp82b.f.
 *
 * ELP measures longitude from the *inertial* equinox, which does not precess.
 * Skipping this step leaves an error growing at the precession rate - about 50
 * arcseconds a year, zero only at J2000 - which is a large error dressed up as
 * a plausible one.
 */
const PRECESSION_P = [0.10180391e-4, 0.47020439e-6, -0.5417367e-9, -0.2507948e-11, 0.463486e-14];
const PRECESSION_Q = [-0.113469002e-3, 0.12372674e-6, 0.1265417e-8, -0.1371808e-11, -0.320334e-14];

function toJ2000(longitude: number, latitude: number, distance: number, t: number[]) {
  const horizontal = distance * Math.cos(latitude);
  const x1 = horizontal * Math.cos(longitude);
  const x2 = horizontal * Math.sin(longitude);
  const x3 = distance * Math.sin(latitude);

  let pw = (PRECESSION_P[0] + PRECESSION_P[1] * t[1] + PRECESSION_P[2] * t[2] + PRECESSION_P[3] * t[3] + PRECESSION_P[4] * t[4]) * t[1];
  let qw = (PRECESSION_Q[0] + PRECESSION_Q[1] * t[1] + PRECESSION_Q[2] * t[2] + PRECESSION_Q[3] * t[3] + PRECESSION_Q[4] * t[4]) * t[1];
  const ra = 2 * Math.sqrt(1 - pw * pw - qw * qw);
  const pwqw = 2 * pw * qw;
  const pw2 = 1 - 2 * pw * pw;
  const qw2 = 1 - 2 * qw * qw;
  pw *= ra;
  qw *= ra;

  return {
    x: pw2 * x1 + pwqw * x2 + pw * x3,
    y: pwqw * x1 + qw2 * x2 - qw * x3,
    z: -pw * x1 + qw * x2 + (pw2 + qw2 - 1) * x3,
  };
}

/**
 * Precession of ecliptic coordinates from J2000 to the equinox of the date.
 * Meeus chapter 21, which rotates the ecliptic itself rather than only sliding
 * the equinox point along it.
 */
function precessFromJ2000(longitude: number, latitude: number, t: number): { longitude: number; latitude: number } {
  const eta = (47.0029 * t - 0.03302 * t * t + 0.00006 * t * t * t) * ARCSEC;
  const pi = (174 + 52 / 60 + 34.982 / 3600) * DEG + (3289.4789 * t + 0.60622 * t * t) * ARCSEC;
  const p = (5029.0966 * t + 1.11113 * t * t - 0.000006 * t * t * t) * ARCSEC;

  const sinPiMinusL = Math.sin(pi - longitude);
  const a = Math.cos(eta) * Math.cos(latitude) * sinPiMinusL - Math.sin(eta) * Math.sin(latitude);
  const b = Math.cos(latitude) * Math.cos(pi - longitude);
  const c = Math.cos(eta) * Math.sin(latitude) + Math.sin(eta) * Math.cos(latitude) * sinPiMinusL;

  return { longitude: normalizeRadians(p + pi - Math.atan2(a, b)), latitude: Math.asin(c) };
}

/**
 * Geometric geocentric position, referred to the mean ecliptic and equinox of
 * the date.
 *
 * The series is evaluated in the theory's own frame, rotated into J2000 the
 * way elp82b.f does, then precessed forward to the date. Going via J2000 keeps
 * the two frame conventions separate and independently checkable, rather than
 * folding both into one correction that happens to fit.
 */
function geometric(jdTT: number): MoonPosition {
  const t2 = julianCenturies(jdTT);
  const t = [1, t2, t2 * t2, t2 * t2 * t2, t2 * t2 * t2 * t2];

  // Accumulators for longitude, latitude and distance, in the theory's units.
  const r = [0, 0, 0];

  for (let file = 1; file <= 36; file += 1) {
    const series = ELP_SERIES[file];
    const variable = ((file - 1) % 3) + 1;
    const index = variable - 1;

    if (MAIN_FILES.has(file)) {
      for (let n = 0; n < series.length; n += 11) {
        const c1 = file === 3 ? series[n + 4] - (2 * series[n + 4] * DELNU) / 3 : series[n + 4];
        const tgv = series[n + 5] + DTASM * series[n + 9];
        const amplitude =
          c1 + tgv * (DELNP - AM * DELNU) + series[n + 6] * DELG + series[n + 7] * DELE + series[n + 8] * DELEP;

        let argument = 0;
        for (let k = 0; k < 5; k += 1) {
          for (let i = 0; i < 4; i += 1) argument += series[n + i] * DEL[i][k] * t[k];
        }
        if (variable === 3) argument += Math.PI / 2;
        r[index] += amplitude * Math.sin(argument);
      }
      continue;
    }

    if (PLANETARY_FILES.has(file)) {
      for (let n = 0; n < series.length; n += 13) {
        let amplitude = series[n + 12];
        if ((file >= 13 && file <= 15) || (file >= 19 && file <= 21)) amplitude *= t[1];

        let argument = series[n + 11] * DEG;
        if (file < 16) {
          for (let k = 0; k < 2; k += 1) {
            argument +=
              (series[n + 8] * DEL[0][k] + series[n + 9] * DEL[2][k] + series[n + 10] * DEL[3][k]) * t[k];
            for (let i = 0; i < 8; i += 1) argument += series[n + i] * PLANET_ARGUMENTS[i][k] * t[k];
          }
        } else {
          for (let k = 0; k < 2; k += 1) {
            for (let i = 0; i < 4; i += 1) argument += series[n + i + 7] * DEL[i][k] * t[k];
            for (let i = 0; i < 7; i += 1) argument += series[n + i] * PLANET_ARGUMENTS[i][k] * t[k];
          }
        }
        r[index] += amplitude * Math.sin(argument);
      }
      continue;
    }

    // Earth figure, tides, relativity and solar eccentricity.
    for (let n = 0; n < series.length; n += 7) {
      let amplitude = series[n + 6];
      if (file >= 7 && file <= 9) amplitude *= t[1];
      if (file >= 25 && file <= 27) amplitude *= t[1];
      if (file >= 34 && file <= 36) amplitude *= t[2];

      let argument = series[n + 5] * DEG;
      for (let k = 0; k < 2; k += 1) {
        argument += series[n] * ZETA[k] * t[k];
        for (let i = 0; i < 4; i += 1) argument += series[n + i + 1] * DEL[i][k] * t[k];
      }
      r[index] += amplitude * Math.sin(argument);
    }
  }

  const inertialLongitude =
    r[0] / RAD + W[0][0] + W[0][1] * t[1] + W[0][2] * t[2] + W[0][3] * t[3] + W[0][4] * t[4];
  const inertialLatitude = r[1] / RAD;
  const distance = (r[2] * A0) / ATH;

  const j2000 = toJ2000(inertialLongitude, inertialLatitude, distance, t);
  const radius = Math.sqrt(j2000.x * j2000.x + j2000.y * j2000.y + j2000.z * j2000.z);
  const ofDate = precessFromJ2000(
    Math.atan2(j2000.y, j2000.x),
    Math.asin(j2000.z / radius),
    t[1],
  );

  return {
    longitude: toDegrees(normalizeRadians(ofDate.longitude)),
    latitude: toDegrees(ofDate.latitude),
    distance: radius,
  };
}

/**
 * Apparent geocentric position of the Moon.
 *
 * Geometric position plus nutation. Light-time is worth about 0.7 arcseconds
 * here and is included, because it is a known systematic and leaving a known
 * systematic in place is how a small bias becomes permanent.
 */
export function moonPosition(jdTT: number): MoonPosition {
  // Light travels the Earth-Moon distance in roughly 1.3 seconds.
  const lightTimeDays = (geometric(jdTT).distance / 299792.458) / 86400;
  const position = geometric(jdTT - lightTimeDays);

  return {
    longitude: (position.longitude + toDegrees(nutation(jdTT).longitude) + 360) % 360,
    latitude: position.latitude,
    distance: position.distance,
  };
}
