import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateAshtakavarga } from "@/lib/astrology/charts/ashtakavarga";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { getSignName, getSignNumberFromName } from "@/lib/astrology/charts/signs";
import { getVargaSign } from "@/lib/astrology/charts/varga";
import { buildDashaTimeline } from "@/lib/astrology/engine/dasha";
import { computeKpChartForBirth } from "@/lib/astrology/kp/chart";

/**
 * The classical rule layer, checked against reference charts.
 *
 * `astronomy-engine.test.ts` already establishes that a planet is where we say
 * it is, against JPL Horizons. This file asks the other question: given a
 * correct longitude, does the tradition's arithmetic on top of it - the vargas,
 * the dasha, the ashtakavarga - land where an authority says it lands.
 *
 * Only fixtures marked `verified` are asserted. An unverified one is inert, so
 * a template can sit in the file without ever claiming to prove anything. When
 * none are verified the suite says so plainly rather than passing silently,
 * because a green run with nothing checked is the failure mode this file exists
 * to avoid.
 */

type Golden = {
  tolerances: { longitudeDegrees: number };
  charts: Array<{
    id: string;
    verified: boolean;
    source: string;
    birth: { dateOfBirth: string; timeOfBirth: string };
    location: { city: string; latitude: number; longitude: number; timezone: string };
    expected: {
      ascendant?: { sign?: string; degree?: number };
      planetLongitudes?: Record<string, number | null>;
      vargaSigns?: Record<string, Record<string, string | null>>;
      vimshottari?: { birthLord?: string | null; balanceYears?: number | null };
      ashtakavarga?: { sarva?: Record<string, number> | null };
    };
  }>;
};

const golden: Golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/golden-charts.json"), "utf8"),
);

const verified = golden.charts.filter((chart) => chart.verified);

describe("golden charts: the classical rule layer", () => {
  it("has a well-formed fixture file", () => {
    expect(golden.tolerances.longitudeDegrees).toBeGreaterThan(0);
    expect(Array.isArray(golden.charts)).toBe(true);

    for (const chart of golden.charts) {
      expect(chart.id).toBeTruthy();
      expect(chart.source).toBeTruthy();
      expect(typeof chart.verified).toBe("boolean");
    }
  });

  it("reports how many references are actually being asserted", () => {
    // Deliberately not a failure. It is a standing, visible statement of how
    // much of the rule layer is externally validated - which is currently none.
    if (verified.length === 0) {
      console.warn(
        "[golden-charts] No verified reference charts. The varga, dasha and ashtakavarga rules are internally consistent but NOT externally validated. Add one to tests/fixtures/golden-charts.json.",
      );
    }
    expect(verified.length).toBeGreaterThanOrEqual(0);
  });

  describe.each(verified.length > 0 ? verified : [])("$id", (chart) => {
    const kp = computeKpChartForBirth(chart.birth, chart.location);
    const planets = kp.planets.map((planet) => ({
      planet: planet.planet,
      longitude: planet.longitude,
      retrograde: false,
    }));

    const rashi = createRashiChart({
      ascendant: {
        sign: chart.expected.ascendant?.sign ?? getSignName(getSignNumberFromName("Aries")),
        degree: chart.expected.ascendant?.degree,
      },
      planets,
    });

    it("places the planets at the reference longitudes", () => {
      for (const [planet, expected] of Object.entries(chart.expected.planetLongitudes ?? {})) {
        if (expected === null) continue;
        const found = planets.find((entry) => entry.planet === planet);
        expect(found, `${planet} is missing from the chart`).toBeTruthy();
        // Numeric comparison with a stated tolerance, never formatted strings.
        expect(Math.abs(found!.longitude - expected)).toBeLessThanOrEqual(
          golden.tolerances.longitudeDegrees,
        );
      }
    });

    it("maps every planet into the reference varga signs", () => {
      for (const [planet, divisions] of Object.entries(chart.expected.vargaSigns ?? {})) {
        const found = planets.find((entry) => entry.planet === planet);
        if (!found) continue;

        for (const [division, expectedSign] of Object.entries(divisions)) {
          if (expectedSign === null) continue;
          expect(
            getSignName(getVargaSign(found.longitude, Number(division))),
            `${planet} in D${division}`,
          ).toBe(expectedSign);
        }
      }
    });

    it("starts the Vimshottari dasha on the reference lord and balance", () => {
      const expected = chart.expected.vimshottari;
      if (!expected?.birthLord && expected?.balanceYears == null) return;

      const moon = kp.planets.find((planet) => planet.planet === "Moon")!;
      const timeline = buildDashaTimeline(kp.instant, moon.longitude, 1);

      if (expected.birthLord) expect(timeline.birthLord).toBe(expected.birthLord);
      if (expected.balanceYears != null) {
        // A published balance is usually given to the day, so a tenth of a year
        // is the tightest a transcribed value can fairly be held to.
        expect(Math.abs(timeline.balanceYears - expected.balanceYears)).toBeLessThanOrEqual(0.1);
      }
    });

    it("matches the reference Sarvashtakavarga", () => {
      const expected = chart.expected.ashtakavarga?.sarva;
      if (!expected) return;

      const { sarva } = calculateAshtakavarga(rashi);
      for (const [sign, bindus] of Object.entries(expected)) {
        expect(sarva[Number(sign)], `sign ${sign}`).toBe(bindus);
      }
    });
  });
});
