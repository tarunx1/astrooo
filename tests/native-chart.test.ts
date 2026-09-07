import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SIGNS } from "@/config/astrology";
import { angularDifference, normalizeDegrees } from "@/lib/astrology/engine/angles";
import { computeChartForBirth, houseOf } from "@/lib/astrology/engine/chart";
import { utcInstantOf } from "@/lib/astrology/engine/local-time";
import { getNakshatraName, getPada } from "@/lib/astrology/kp/vimshottari";

/**
 * The whole engine, end to end, against charts the former provider produced.
 *
 * This is a compatibility test, not a correctness test: it is evidence that
 * replacing the provider does not change anyone's existing chart. Correctness
 * is settled against JPL Horizons in astronomy-engine.test.ts, because
 * agreeing with the thing being replaced proves only that we copied it.
 */
const fixture = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/provider-charts.json"), "utf8"),
) as {
  charts: {
    birth: { dateOfBirth: string; timeOfBirth: string };
    location: { latitude: number; longitude: number; timezone: string; city: string };
    ascendant: { sign: string; degree: number };
    planets: {
      planet: string;
      longitude: number;
      sign: string;
      house: number;
      nakshatra: string;
      nakshatraPada: number;
    }[];
  }[];
};

/**
 * How far a placement may sit from the provider's stored value.
 *
 * Two effects, both bounded and both harmless. The provider stored two decimal
 * places, worth up to 0.6 arcmin on its own. On top of that its Lahiri differs
 * from ours by up to about 26 arcsec in the early 1990s and by under an
 * arcsecond in 2001 - several implementations of Lahiri exist and they disagree
 * at exactly this level.
 *
 * It is not a time-handling error, which is the failure that would matter: a
 * wrong instant moves the Moon about twenty-eight times as far as the Sun, and
 * here the Moon is offset by the same fraction of an arcminute as Saturn.
 *
 * For scale, the finest division this product reads is a KP sub-sub lord at
 * 9.6 arcmin and a nakshatra pada is 200 arcmin, so nothing at this size can
 * change a reading. Every sign, house, nakshatra and pada below is asserted to
 * match exactly, and they all do.
 */
const TOLERANCE_DEGREES = 0.025;

describe("native chart against the former provider's stored charts", () => {
  it("covers several births, places and years", () => {
    expect(fixture.charts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(fixture.charts.map((chart) => chart.birth.dateOfBirth)).size).toBeGreaterThanOrEqual(3);
  });

  for (const chart of fixture.charts) {
    const label = `${chart.location.city} ${chart.birth.dateOfBirth} ${chart.birth.timeOfBirth}`;

    it(`reproduces the chart for ${label}`, () => {
      const ours = computeChartForBirth(chart.birth, chart.location);

      expect(ours.ascendant.sign, `${label} ascendant sign`).toBe(chart.ascendant.sign);
      expect(Math.abs(ours.ascendant.degreeInSign - chart.ascendant.degree), `${label} ascendant degree`).toBeLessThan(
        TOLERANCE_DEGREES,
      );

      for (const expected of chart.planets) {
        const actual = ours.planets.find((planet) => planet.planet === expected.planet);
        expect(actual, `${label} ${expected.planet} missing`).toBeDefined();
        if (!actual) continue;

        const context = `${label} ${expected.planet}`;
        expect(Math.abs(angularDifference(actual.longitude, expected.longitude)), context).toBeLessThan(
          TOLERANCE_DEGREES,
        );
        expect(actual.sign, `${context} sign`).toBe(expected.sign);
        expect(actual.house, `${context} house`).toBe(expected.house);

        // Checked against what the provider's own longitude implies, not
        // against the label it stored beside it. Four of its stored rows
        // disagree with their own longitudes - see the test below.
        expect(actual.nakshatra, `${context} nakshatra`).toBe(getNakshatraName(expected.longitude));
        expect(actual.nakshatraPada, `${context} pada`).toBe(getPada(expected.longitude));
      }
    });
  }

  it("agrees on every placement across every stored chart", () => {
    let worst = 0;
    let placements = 0;
    for (const chart of fixture.charts) {
      const ours = computeChartForBirth(chart.birth, chart.location);
      for (const expected of chart.planets) {
        const actual = ours.planets.find((planet) => planet.planet === expected.planet)!;
        worst = Math.max(worst, Math.abs(angularDifference(actual.longitude, expected.longitude)));
        placements += 1;
      }
    }
    expect(placements).toBeGreaterThanOrEqual(36);
    // Recorded as a number so a regression is visible, not just a failed flag.
    expect(worst * 60).toBeLessThan(1);
  });

  it("records the provider rows whose nakshatra contradicts their own longitude", () => {
    /**
     * A real defect in data already served to users, found by this migration.
     *
     * In one stored chart four planets carry the nakshatra "Ashwini" - the
     * first of the twenty-seven, the value a failed lookup falls back to -
     * while the longitudes stored beside them are 102 to 144 degrees, nowhere
     * near it. The longitudes are right; only the labels are wrong.
     *
     * Pinned rather than filtered away, so the count cannot grow unnoticed and
     * so it stays on record that these charts need recalculating.
     */
    const inconsistent: string[] = [];
    for (const chart of fixture.charts) {
      for (const planet of chart.planets) {
        if (
          getNakshatraName(planet.longitude) !== planet.nakshatra ||
          getPada(planet.longitude) !== planet.nakshatraPada
        ) {
          inconsistent.push(`${chart.birth.dateOfBirth} ${planet.planet}`);
        }
      }
    }

    expect(inconsistent).toEqual([
      "1992-08-14 Sun",
      "1992-08-14 Mercury",
      "1992-08-14 Jupiter",
      "1992-08-14 Venus",
    ]);
    // Every one of them was labelled with the first nakshatra in the list.
    for (const chart of fixture.charts) {
      for (const planet of chart.planets) {
        if (getNakshatraName(planet.longitude) !== planet.nakshatra) {
          expect(planet.nakshatra).toBe("Ashwini");
        }
      }
    }
  });

  it("differs from the provider by an offset, not by scattered errors", () => {
    // The distinguishing test. A shared offset across every body in a chart is
    // an ayanamsa convention; scatter that grows with a body's speed is a
    // wrong instant, which would be a real bug.
    for (const chart of fixture.charts) {
      const ours = computeChartForBirth(chart.birth, chart.location);
      const offsets = chart.planets.map((expected) => {
        const actual = ours.planets.find((planet) => planet.planet === expected.planet)!;
        return angularDifference(actual.longitude, expected.longitude) * 60;
      });

      const moon = offsets[chart.planets.findIndex((planet) => planet.planet === "Moon")];
      const saturn = offsets[chart.planets.findIndex((planet) => planet.planet === "Saturn")];
      // The Moon moves about twenty-eight times as fast as Saturn. If the
      // instant were wrong, these two could not be the same size.
      expect(Math.abs(moon) - Math.abs(saturn)).toBeLessThan(0.5);
    }
  });
});

describe("chart assembly", () => {
  const birth = { dateOfBirth: "2001-11-27", timeOfBirth: "20:30" };
  const location = { latitude: 31.634, longitude: 74.8723, timezone: "Asia/Kolkata" };

  it("marks the nodes retrograde and the lights never", () => {
    const chart = computeChartForBirth(birth, location);
    const of = (name: string) => chart.planets.find((planet) => planet.planet === name)!;

    // The mean node always regresses; this is measured, not special-cased.
    expect(of("Rahu").retrograde).toBe(true);
    expect(of("Ketu").retrograde).toBe(true);
    expect(of("Sun").retrograde).toBe(false);
    expect(of("Moon").retrograde).toBe(false);
    expect(of("Moon").speed).toBeGreaterThan(11);
  });

  it("keeps Ketu exactly opposite Rahu in the chart", () => {
    const chart = computeChartForBirth(birth, location);
    const rahu = chart.planets.find((planet) => planet.planet === "Rahu")!;
    const ketu = chart.planets.find((planet) => planet.planet === "Ketu")!;
    expect(normalizeDegrees(ketu.longitude - rahu.longitude)).toBeCloseTo(180, 6);
  });

  it("puts whole-sign house cusps on sidereal sign boundaries", () => {
    // The bug this guards against put them an ayanamsa short, which moved
    // planets near a boundary one house over while the chart still looked fine.
    const chart = computeChartForBirth(birth, location);
    for (const cusp of chart.houseCusps) expect(cusp % 30).toBeCloseTo(0, 9);
    expect(chart.houseCusps[0]).toBe(Math.floor(chart.ascendant.longitude / 30) * 30);
  });

  it("agrees between the house lookup and the sign offset for whole-sign charts", () => {
    const chart = computeChartForBirth(birth, location);
    const ascendantSign = SIGNS.indexOf(chart.ascendant.sign);
    for (const planet of chart.planets) {
      const bySign = (((SIGNS.indexOf(planet.sign) - ascendantSign) % 12) + 12) % 12 + 1;
      expect(planet.house, `${planet.planet}`).toBe(bySign);
    }
  });

  it("gives Placidus different houses from whole-sign for the same birth", () => {
    const whole = computeChartForBirth(birth, location, "whole-sign");
    const placidus = computeChartForBirth(birth, location, "placidus");

    expect(placidus.houseCusps[0]).toBeCloseTo(placidus.ascendant.longitude, 9);
    // Unequal by construction: that is what a quadrant system is.
    const spans = placidus.houseCusps.map((cusp, index) =>
      normalizeDegrees(placidus.houseCusps[(index + 1) % 12] - cusp),
    );
    expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(1);
    expect(whole.planets.map((planet) => planet.house)).not.toEqual(placidus.planets.map((planet) => planet.house));
  });

  it("assigns every planet a house in range for every system", () => {
    for (const system of ["whole-sign", "equal", "porphyry", "placidus"] as const) {
      const chart = computeChartForBirth(birth, location, system);
      for (const planet of chart.planets) {
        expect(planet.house, `${system} ${planet.planet}`).toBeGreaterThanOrEqual(1);
        expect(planet.house, `${system} ${planet.planet}`).toBeLessThanOrEqual(12);
        expect(houseOf(planet.longitude, chart.houseCusps)).toBe(planet.house);
      }
    }
  });
});

describe("local time", () => {
  it("resolves a wall clock reading through its zone's offset", () => {
    expect(utcInstantOf("2001-11-27", "20:30", "Asia/Kolkata").toISOString()).toBe("2001-11-27T15:00:00.000Z");
    expect(utcInstantOf("2020-06-15", "12:00", "UTC").toISOString()).toBe("2020-06-15T12:00:00.000Z");
  });

  it("applies daylight saving as it stood on the day", () => {
    // London is UTC in January and UTC+1 in July.
    expect(utcInstantOf("2020-01-15", "12:00", "Europe/London").toISOString()).toBe("2020-01-15T12:00:00.000Z");
    expect(utcInstantOf("2020-07-15", "12:00", "Europe/London").toISOString()).toBe("2020-07-15T11:00:00.000Z");
  });

  it("uses the offset in force historically, not today's", () => {
    // India used UTC+5:30 in 1955; the zone has not moved since, so this also
    // guards the lookup being anchored to the birth rather than to now.
    expect(utcInstantOf("1955-03-10", "06:00", "Asia/Kolkata").toISOString()).toBe("1955-03-10T00:30:00.000Z");
  });

  it("still resolves a reading inside a daylight saving gap", () => {
    // 02:30 on this date never existed in London. A birth certificate says
    // what it says, so this must produce an instant rather than refuse.
    expect(() => utcInstantOf("2020-03-29", "02:30", "Europe/London")).not.toThrow();
  });
});
