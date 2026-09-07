import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { angularDifference } from "@/lib/astrology/engine/angles";
import { apparentPosition, type EphemerisBody } from "@/lib/astrology/engine/geocentric";
import { moonPosition } from "@/lib/astrology/engine/moon";
import { meanObliquity, nutation } from "@/lib/astrology/engine/nutation";
import { deltaTSeconds, julianDay, terrestrialTime } from "@/lib/astrology/engine/time";

/**
 * The astronomy engine, checked against JPL Horizons.
 *
 * Everything else in this product is a rule applied to a longitude. If a
 * longitude is wrong, every chart, dasha and panchang built on it is wrong in
 * a way that still looks entirely plausible - so this is the one place where
 * an independent authority, rather than self-consistency, is the test.
 */
const reference = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/horizons-positions.json"), "utf8"),
) as {
  positions: Record<string, Record<string, { longitude: number; latitude: number }>>;
};

const instantOf = (when: string) => new Date(`${when.replace(" ", "T")}:00Z`);
const arcseconds = (a: number, b: number) => Math.abs(angularDifference(a, b)) * 3600;

/**
 * Inside the observed delta-T record the engine agrees with Horizons to a
 * small fraction of an arcsecond. Beyond it, delta-T is extrapolated and the
 * fastest bodies drift by a couple of arcseconds; that is a property of the
 * Earth's rotation being unpredictable, not of the theory.
 */
const OBSERVED_ERA_TOLERANCE = 1.0;
const EXTRAPOLATED_ERA_TOLERANCE = 12.0;

const extrapolated = (when: string) => when >= "2027" || when < "1973";

describe("astronomy engine against JPL Horizons", () => {
  const dates = Object.keys(reference.positions);

  it("has fixtures spanning the range a birth chart needs", () => {
    expect(dates.length).toBeGreaterThanOrEqual(10);
    expect(dates[0] < "1930").toBe(true);
    expect(dates[dates.length - 1] > "2040").toBe(true);
  });

  for (const when of dates) {
    const tolerance = extrapolated(when) ? EXTRAPOLATED_ERA_TOLERANCE : OBSERVED_ERA_TOLERANCE;

    it(`places every body at ${when}`, () => {
      const jdTT = terrestrialTime(instantOf(when));

      for (const [body, expected] of Object.entries(reference.positions[when])) {
        const actual =
          body === "moon" ? moonPosition(jdTT) : apparentPosition(body as EphemerisBody, jdTT);

        expect(
          arcseconds(actual.longitude, expected.longitude),
          `${body} longitude at ${when}`,
        ).toBeLessThan(tolerance);

        expect(Math.abs(actual.latitude - expected.latitude) * 3600, `${body} latitude at ${when}`).toBeLessThan(
          tolerance,
        );
      }
    });
  }

  it("agrees with Horizons to well under an arcsecond through the observed era", () => {
    let worst = 0;
    for (const when of dates.filter((date) => !extrapolated(date))) {
      const jdTT = terrestrialTime(instantOf(when));
      for (const [body, expected] of Object.entries(reference.positions[when])) {
        const actual = body === "moon" ? moonPosition(jdTT) : apparentPosition(body as EphemerisBody, jdTT);
        worst = Math.max(worst, arcseconds(actual.longitude, expected.longitude));
      }
    }
    // Recorded so a regression shows up as a number, not a pass/fail flip.
    expect(worst).toBeLessThan(0.6);
  });
});

describe("time scales", () => {
  it("reads delta-T from the observed record where it exists", () => {
    // 2020-01-01. The IERS value is near 69.4s; the Espenak & Meeus
    // polynomial gives about 71.6s, so a wrong branch is obvious here.
    const dt = deltaTSeconds(julianDay(new Date("2020-01-01T00:00:00Z")));
    expect(dt).toBeGreaterThan(69);
    expect(dt).toBeLessThan(70);
  });

  it("falls back to the model outside the record without a step change", () => {
    // Either side of the table's start in 1973 the two sources must agree
    // closely, or charts would shift as a birth date crossed the boundary.
    const before = deltaTSeconds(julianDay(new Date("1972-11-01T00:00:00Z")));
    const after = deltaTSeconds(julianDay(new Date("1973-03-01T00:00:00Z")));
    expect(Math.abs(after - before)).toBeLessThan(0.5);
  });

  it("grows delta-T monotonically across the observed record", () => {
    const at = (year: number) => deltaTSeconds(julianDay(new Date(`${year}-01-01T00:00:00Z`)));
    expect(at(1980)).toBeGreaterThan(at(1975));
    expect(at(2000)).toBeGreaterThan(at(1990));
    expect(at(2020)).toBeGreaterThan(at(2010));
  });

  it("converts civil time to terrestrial time", () => {
    const date = new Date("2000-01-01T12:00:00Z");
    // Nine places, not more: differencing two Julian Days near 2451545 leaves
    // about 1e-10 of a day in double-precision noise, which is 1e-5 seconds.
    expect(terrestrialTime(date) - julianDay(date)).toBeCloseTo(deltaTSeconds(julianDay(date)) / 86400, 9);
  });
});

describe("nutation and obliquity", () => {
  it("matches the standard worked value for 1987 April 10", () => {
    // Meeus, Astronomical Algorithms, example 22.a: JDE 2446895.5 gives
    // nutation in longitude -3.788", in obliquity +9.443", mean obliquity
    // 23 deg 26' 27.407".
    const jd = 2446895.5;
    const { longitude, obliquity } = nutation(jd);

    expect((longitude * 180 * 3600) / Math.PI).toBeCloseTo(-3.788, 0);
    expect((obliquity * 180 * 3600) / Math.PI).toBeCloseTo(9.443, 0);
    expect((meanObliquity(jd) * 180) / Math.PI).toBeCloseTo(23 + 26 / 60 + 27.407 / 3600, 5);
  });

  it("keeps nutation within its physical bounds", () => {
    for (let year = 1900; year <= 2100; year += 3) {
      const { longitude } = nutation(julianDay(new Date(`${year}-06-01T00:00:00Z`)));
      expect(Math.abs((longitude * 180 * 3600) / Math.PI)).toBeLessThan(20);
    }
  });
});
