import { describe, expect, it } from "vitest";
import { DEG, normalizeDegrees, toDegrees } from "@/lib/astrology/engine/angles";
import { lahiriAyanamsa, toSidereal } from "@/lib/astrology/engine/ayanamsa";
import {
  HouseSystemUnavailableError,
  ascendant,
  houses,
  localSiderealTime,
  midheaven,
  type HouseSystem,
} from "@/lib/astrology/engine/houses";
import { moonPosition } from "@/lib/astrology/engine/moon";
import { lunarNodes, meanLunarNode, trueLunarNode } from "@/lib/astrology/engine/nodes";
import { trueObliquity } from "@/lib/astrology/engine/nutation";
import { terrestrialTime } from "@/lib/astrology/engine/time";

/**
 * The Vedic layer: ayanamsa, nodes and houses.
 *
 * These turn an astronomical position into an astrological one. The tests
 * lean on geometry rather than on remembered numbers wherever they can - the
 * ascendant has to sit on the horizon, Placidus has to reduce to equal
 * divisions at the equator - because a placement that is merely plausible is
 * exactly the failure that would never be noticed.
 */

/** Amritsar, 2001-11-27 20:30 IST. A real stored chart, computed by the former provider. */
const REFERENCE = {
  date: new Date("2001-11-27T15:00:00Z"),
  latitude: 31.634,
  longitude: 74.8723,
  /** Provider's stored sidereal values, Lahiri. */
  ascendantSidereal: 60 + 25.44,
  rahuSidereal: 64.3,
  ayanamsa: 23.8794,
};

/** Altitude of an ecliptic degree above the horizon. Zero means it is on it. */
function altitude(longitude: number, obliquity: number, siderealTime: number, latitude: number): number {
  const lambda = longitude * DEG;
  const rightAscension = Math.atan2(Math.sin(lambda) * Math.cos(obliquity), Math.cos(lambda));
  const declination = Math.asin(Math.sin(lambda) * Math.sin(obliquity));
  const hourAngle = siderealTime * DEG - rightAscension;
  const phi = latitude * DEG;
  return toDegrees(
    Math.asin(
      Math.sin(phi) * Math.sin(declination) +
        Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
    ),
  );
}

describe("Lahiri ayanamsa", () => {
  it("matches the value implied by a chart the former provider calculated", () => {
    const jdTT = terrestrialTime(REFERENCE.date);
    // Two independent routes to the same number: our J2000 anchor carried
    // forward by precession, and seven of the provider's own planets differenced
    // against our tropical positions.
    expect(Math.abs(lahiriAyanamsa(jdTT) - REFERENCE.ayanamsa) * 3600).toBeLessThan(5);
  });

  it("advances at the rate of precession", () => {
    const at = (year: number) => lahiriAyanamsa(terrestrialTime(new Date(`${year}-01-01T00:00:00Z`)));
    const perYear = ((at(2050) - at(1950)) / 100) * 3600;
    expect(perYear).toBeGreaterThan(50.1);
    expect(perYear).toBeLessThan(50.5);
  });

  it("is about 23 degrees 51 minutes at J2000 and always increasing", () => {
    const j2000 = lahiriAyanamsa(2451545.0);
    expect(j2000).toBeCloseTo(23 + 51 / 60 + 11.6 / 3600, 4);

    let previous = -Infinity;
    for (let year = 1900; year <= 2100; year += 10) {
      const value = lahiriAyanamsa(terrestrialTime(new Date(`${year}-01-01T00:00:00Z`)));
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it("subtracts cleanly, wrapping across zero", () => {
    const jdTT = terrestrialTime(REFERENCE.date);
    const ayanamsa = lahiriAyanamsa(jdTT);
    expect(toSidereal(10, jdTT)).toBeCloseTo(normalizeDegrees(10 - ayanamsa), 10);
    expect(toSidereal(10, jdTT)).toBeGreaterThan(340);
  });
});

describe("lunar nodes", () => {
  const jdTT = terrestrialTime(REFERENCE.date);

  it("puts the mean node where the former provider put Rahu", () => {
    const sidereal = toSidereal(meanLunarNode(jdTT), jdTT);
    // The provider stored two decimal places, so this is agreement to its
    // full stored precision - and it also settles that it used the mean node.
    expect(Math.abs(sidereal - REFERENCE.rahuSidereal)).toBeLessThan(0.02);
  });

  it("keeps Ketu exactly opposite Rahu", () => {
    for (const mode of ["mean", "true"] as const) {
      const { rahu, ketu } = lunarNodes(jdTT, mode);
      expect(normalizeDegrees(ketu - rahu)).toBeCloseTo(180, 9);
    }
  });

  it("moves the node backwards through the zodiac", () => {
    // The nodes regress, about 19.3 years for a full circuit.
    const later = meanLunarNode(jdTT + 30);
    expect(normalizeDegrees(meanLunarNode(jdTT) - later)).toBeGreaterThan(0);
    expect(normalizeDegrees(meanLunarNode(jdTT) - later)).toBeLessThan(3);
  });

  it("keeps the true node near the mean node", () => {
    // The true node oscillates about the mean one by up to roughly 1.6 degrees.
    for (let day = 0; day < 400; day += 17) {
      const difference = Math.abs(((trueLunarNode(jdTT + day) - meanLunarNode(jdTT + day) + 540) % 360) - 180);
      expect(difference).toBeLessThan(2);
    }
  });

  it("puts the true node where the Moon actually crosses the ecliptic", () => {
    // The defining property: the ascending node is where the Moon's latitude
    // passes through zero going north. Find that crossing by bisection, then
    // ask where the node was at that instant - the two must be the same point.
    let low = jdTT;
    let high = jdTT;
    for (let day = 0; day < 30; day += 0.5) {
      if (moonPosition(jdTT + day).latitude < 0 && moonPosition(jdTT + day + 0.5).latitude >= 0) {
        low = jdTT + day;
        high = jdTT + day + 0.5;
        break;
      }
    }
    expect(high).toBeGreaterThan(low);

    for (let step = 0; step < 40; step += 1) {
      const middle = (low + high) / 2;
      if (moonPosition(middle).latitude < 0) low = middle;
      else high = middle;
    }

    const crossing = (low + high) / 2;
    const separation = Math.abs(
      ((moonPosition(crossing).longitude - trueLunarNode(crossing) + 540) % 360) - 180,
    );
    // Within an arcminute of the node the theory itself places.
    expect(separation).toBeLessThan(1 / 60);
  });
});

describe("ascendant and midheaven", () => {
  it("matches the ascendant the former provider calculated", () => {
    const jdTT = terrestrialTime(REFERENCE.date);
    const siderealTime = localSiderealTime(REFERENCE.date, REFERENCE.longitude);
    const value = toSidereal(ascendant(siderealTime, trueObliquity(jdTT), REFERENCE.latitude), jdTT);
    expect(Math.abs(value - REFERENCE.ascendantSidereal)).toBeLessThan(0.02);
  });

  it("puts the ascendant on the horizon, everywhere and always", () => {
    for (let hour = 0; hour < 24; hour += 3) {
      for (const latitude of [-54, -33.9, 0, 19.1, 31.6, 51.5, 64]) {
        for (const longitude of [-122.4, -3.2, 74.9, 139.7]) {
          const date = new Date(Date.UTC(2003, 6, 14, hour, 37));
          const jdTT = terrestrialTime(date);
          const obliquity = trueObliquity(jdTT);
          const siderealTime = localSiderealTime(date, longitude);
          const value = ascendant(siderealTime, obliquity, latitude);

          expect(Math.abs(altitude(value, obliquity, siderealTime, latitude))).toBeLessThan(1e-8);
          // Rising, not setting: the degree behind it has already come up.
          expect(altitude(value - 0.1, obliquity, siderealTime, latitude)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("puts the midheaven on the meridian", () => {
    for (let hour = 0; hour < 24; hour += 5) {
      const date = new Date(Date.UTC(1988, 2, 3, hour));
      const obliquity = trueObliquity(terrestrialTime(date));
      const siderealTime = localSiderealTime(date, 12.5);
      const value = midheaven(siderealTime, obliquity);

      const lambda = value * DEG;
      const rightAscension = toDegrees(Math.atan2(Math.sin(lambda) * Math.cos(obliquity), Math.cos(lambda)));
      const hourAngle = ((siderealTime - rightAscension + 540) % 360) - 180;
      expect(Math.abs(hourAngle)).toBeLessThan(1e-8);
    }
  });

  it("advances sidereal time by about 361 degrees a day", () => {
    const date = new Date("2010-05-05T00:00:00Z");
    const next = new Date(date.getTime() + 86400000);
    const advance = normalizeDegrees(localSiderealTime(next, 0) - localSiderealTime(date, 0));
    expect(advance).toBeGreaterThan(0.9);
    expect(advance).toBeLessThan(1.1);
  });
});

describe("house systems", () => {
  const SYSTEMS: HouseSystem[] = ["placidus", "porphyry", "equal", "whole-sign"];

  it("returns twelve cusps that go once round the zodiac, in order", () => {
    for (const system of SYSTEMS) {
      const result = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, system);
      expect(result.cusps).toHaveLength(12);

      let total = 0;
      for (let index = 0; index < 12; index += 1) {
        const span = normalizeDegrees(result.cusps[(index + 1) % 12] - result.cusps[index]);
        expect(span).toBeGreaterThan(0);
        total += span;
      }
      expect(total).toBeCloseTo(360, 8);
    }
  });

  it("starts quadrant systems at the ascendant and the midheaven", () => {
    for (const system of ["placidus", "porphyry", "equal"] as const) {
      const result = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, system);
      expect(result.cusps[0]).toBeCloseTo(result.ascendant, 9);
      if (system !== "equal") expect(result.cusps[9]).toBeCloseTo(result.midheaven, 9);
    }
  });

  it("makes whole-sign houses begin at sign boundaries", () => {
    const result = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, "whole-sign");
    for (const cusp of result.cusps) expect(cusp % 30).toBeCloseTo(0, 9);
  });

  it("reduces Placidus to equal steps of right ascension at the equator", () => {
    // Placidus divides semi-arcs. At the equator every semi-arc is 90 degrees,
    // so the cusps must fall exactly 30 degrees apart in right ascension.
    const date = new Date("2001-11-27T15:00:00Z");
    const obliquity = trueObliquity(terrestrialTime(date));
    // Exactly the equator: tan(0) is zero, so every semi-arc is exactly 90.
    const result = houses(date, 0, 74.8723, "placidus");

    const rightAscensions = result.cusps.map((cusp) => {
      const lambda = cusp * DEG;
      return normalizeDegrees(toDegrees(Math.atan2(Math.sin(lambda) * Math.cos(obliquity), Math.cos(lambda))));
    });
    for (let index = 0; index < 12; index += 1) {
      const step = normalizeDegrees(rightAscensions[index] - rightAscensions[(index + 11) % 12]);
      expect(step).toBeCloseTo(30, 6);
    }
  });

  it("refuses Placidus inside the polar circles instead of inventing cusps", () => {
    expect(() => houses(REFERENCE.date, 78, 15, "placidus")).toThrow(HouseSystemUnavailableError);
    expect(() => houses(REFERENCE.date, -71, 15, "placidus")).toThrow(/never rise/i);
    // The systems that remain defined there still work.
    expect(() => houses(REFERENCE.date, 78, 15, "whole-sign")).not.toThrow();
  });

  it("keeps opposite Placidus cusps exactly opposite", () => {
    const result = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, "placidus");
    for (let index = 0; index < 6; index += 1) {
      expect(normalizeDegrees(result.cusps[index + 6] - result.cusps[index])).toBeCloseTo(180, 9);
    }
  });

  it("gives Placidus and Porphyry the same angles but different intermediate cusps", () => {
    const placidus = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, "placidus");
    const porphyry = houses(REFERENCE.date, REFERENCE.latitude, REFERENCE.longitude, "porphyry");

    // The four angles are shared by construction.
    for (const index of [0, 3, 6, 9]) {
      expect(placidus.cusps[index]).toBeCloseTo(porphyry.cusps[index], 9);
    }
    // The rest are not, which is the entire reason KP insists on Placidus.
    expect(Math.abs(placidus.cusps[1] - porphyry.cusps[1])).toBeGreaterThan(1);
  });
});
