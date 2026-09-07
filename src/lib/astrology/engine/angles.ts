/** Angle helpers shared by the engine. Radians internally, degrees at the edges. */

export const DEG = Math.PI / 180;
export const ARCSEC = DEG / 3600;

/** Wraps to [0, 360). */
export function normalizeDegrees(value: number): number {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Wraps to [0, 2*PI). */
export function normalizeRadians(value: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = value % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

/** Signed difference a - b, wrapped to (-180, 180]. For comparing two longitudes. */
export function angularDifference(a: number, b: number): number {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff <= -180) diff += 360;
  return diff;
}

export const toDegrees = (radians: number): number => radians / DEG;
export const toRadians = (degrees: number): number => degrees * DEG;
