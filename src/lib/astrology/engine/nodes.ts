import { DEG, normalizeDegrees, normalizeRadians, toDegrees } from "@/lib/astrology/engine/angles";
import { moonPosition } from "@/lib/astrology/engine/moon";
import { julianCenturies } from "@/lib/astrology/engine/time";

/**
 * Rahu and Ketu: the lunar nodes.
 *
 * These are not bodies. They are the two points where the Moon's orbit crosses
 * the ecliptic, and they are where eclipses happen - which is why a tradition
 * that watched the sky carefully gave them the weight it did. Ketu is always
 * exactly opposite Rahu, so it is derived rather than computed twice.
 *
 * Two definitions are in use. The mean node moves smoothly backwards; the true
 * node is the instantaneous crossing point, which oscillates around the mean
 * by up to about 1.6 degrees. Vedic practice overwhelmingly uses the mean
 * node, and that is the default here.
 */

/**
 * Mean longitude of the ascending node, degrees, referred to the mean equinox
 * of date. Meeus chapter 47.
 */
export function meanLunarNode(jdTT: number): number {
  const t = julianCenturies(jdTT);
  return normalizeDegrees(
    125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441 - (t * t * t * t) / 60616000,
  );
}

/**
 * True longitude of the ascending node, degrees.
 *
 * Derived from the Moon's own motion rather than from a separate series: the
 * orbital plane is fixed by the angular momentum vector r x v, and the node is
 * where that plane meets the ecliptic. Using the lunar theory we already have
 * means the node cannot drift out of agreement with the Moon it belongs to.
 */
export function trueLunarNode(jdTT: number): number {
  // A tenth of a day either side. Long enough that differencing two positions
  // is not swamped by floating point, short enough that the arc is effectively
  // straight.
  const step = 0.1;

  const toVector = (jd: number) => {
    const { longitude, latitude, distance } = moonPosition(jd);
    const lon = longitude * DEG;
    const lat = latitude * DEG;
    const horizontal = distance * Math.cos(lat);
    return { x: horizontal * Math.cos(lon), y: horizontal * Math.sin(lon), z: distance * Math.sin(lat) };
  };

  const before = toVector(jdTT - step);
  const after = toVector(jdTT + step);
  const position = toVector(jdTT);

  const velocity = {
    x: (after.x - before.x) / (2 * step),
    y: (after.y - before.y) / (2 * step),
    z: (after.z - before.z) / (2 * step),
  };

  // Angular momentum, normal to the orbital plane.
  const hx = position.y * velocity.z - position.z * velocity.y;
  const hy = position.z * velocity.x - position.x * velocity.z;

  // The ascending node lies along z x h, which is (-hy, hx, 0).
  return normalizeDegrees(toDegrees(normalizeRadians(Math.atan2(hx, -hy))));
}

/** Rahu and Ketu together, in degrees. Ketu is always opposite Rahu. */
export function lunarNodes(jdTT: number, mode: "mean" | "true" = "mean"): { rahu: number; ketu: number } {
  const rahu = mode === "true" ? trueLunarNode(jdTT) : meanLunarNode(jdTT);
  return { rahu, ketu: normalizeDegrees(rahu + 180) };
}
