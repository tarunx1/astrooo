import { DEG, toDegrees } from "@/lib/astrology/engine/angles";
import { apparentPosition } from "@/lib/astrology/engine/geocentric";
import { localSiderealTime } from "@/lib/astrology/engine/houses";
import { trueObliquity } from "@/lib/astrology/engine/nutation";
import { terrestrialTime } from "@/lib/astrology/engine/time";

/**
 * Sunrise and sunset.
 *
 * Found by solving for the moment the Sun's centre reaches a fixed altitude,
 * rather than from a closed-form approximation. The engine can already place
 * the Sun at any instant, so root-finding on its altitude is both simpler and
 * more accurate than the usual series - and it stays correct at high latitudes
 * where the approximations degrade.
 */

/**
 * Standard altitude of the Sun's centre at rise and set: -50 arcminutes.
 *
 * The Sun is not a point and the atmosphere bends its light, so its centre is
 * already below the horizon when its upper limb appears. Refraction accounts
 * for 34 arcminutes of that and the Sun's own semidiameter for 16.
 */
const HORIZON_ALTITUDE = -50 / 60;

/** The Sun's altitude in degrees at an instant, for an observer. */
export function sunAltitude(at: Date, latitude: number, longitudeEast: number): number {
  const jdTT = terrestrialTime(at);
  const obliquity = trueObliquity(jdTT);
  const { longitude, latitude: eclipticLatitude } = apparentPosition("sun", jdTT);

  const lambda = longitude * DEG;
  const beta = eclipticLatitude * DEG;

  // Ecliptic to equatorial, keeping the Sun's small ecliptic latitude.
  const rightAscension = Math.atan2(
    Math.sin(lambda) * Math.cos(obliquity) - Math.tan(beta) * Math.sin(obliquity),
    Math.cos(lambda),
  );
  const declination = Math.asin(
    Math.sin(beta) * Math.cos(obliquity) + Math.cos(beta) * Math.sin(obliquity) * Math.sin(lambda),
  );

  const hourAngle = localSiderealTime(at, longitudeEast) * DEG - rightAscension;
  const phi = latitude * DEG;

  return toDegrees(
    Math.asin(
      Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
    ),
  );
}

/**
 * Thrown when the Sun does not cross the horizon on a given day, which is a
 * real thing that happens rather than an error to paper over.
 */
export class NoSunCrossingError extends Error {
  constructor(
    message: string,
    readonly kind: "polar-day" | "polar-night",
  ) {
    super(message);
    this.name = "NoSunCrossingError";
  }
}

/**
 * Sunrise and sunset bracketing a local day.
 *
 * `dayStart` must be the local midnight of the day in question, as a UTC
 * instant. The search runs over the following 24 hours and finds the first
 * crossing in each direction.
 */
export function sunTimes(
  dayStart: Date,
  latitude: number,
  longitudeEast: number,
): { sunrise: Date; sunset: Date } {
  const altitudeAt = (offsetMinutes: number) =>
    sunAltitude(new Date(dayStart.getTime() + offsetMinutes * 60000), latitude, longitudeEast) -
    HORIZON_ALTITUDE;

  // Ten-minute sweep to bracket each crossing, then bisection to the second.
  const step = 10;
  let rising: [number, number] | null = null;
  let setting: [number, number] | null = null;

  let previousOffset = 0;
  let previous = altitudeAt(0);

  for (let offset = step; offset <= 24 * 60; offset += step) {
    const current = altitudeAt(offset);
    if (previous < 0 && current >= 0 && !rising) rising = [previousOffset, offset];
    if (previous >= 0 && current < 0 && !setting) setting = [previousOffset, offset];
    previousOffset = offset;
    previous = current;
  }

  if (!rising || !setting) {
    const midday = altitudeAt(12 * 60);
    throw new NoSunCrossingError(
      midday >= 0
        ? "The Sun does not set on this day at this latitude."
        : "The Sun does not rise on this day at this latitude.",
      midday >= 0 ? "polar-day" : "polar-night",
    );
  }

  const refine = ([low, high]: [number, number]) => {
    let lowOffset = low;
    let highOffset = high;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const middle = (lowOffset + highOffset) / 2;
      const sign = Math.sign(altitudeAt(lowOffset));
      if (Math.sign(altitudeAt(middle)) === sign) lowOffset = middle;
      else highOffset = middle;
    }
    return new Date(dayStart.getTime() + ((lowOffset + highOffset) / 2) * 60000);
  };

  return { sunrise: refine(rising), sunset: refine(setting) };
}
