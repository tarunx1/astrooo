import { describe, expect, it } from "vitest";
import {
  ASHTAKAVARGA_PLANETS,
  CLASSICAL_SARVA_TOTAL,
  CLASSICAL_TOTALS,
  CONTRIBUTORS,
  calculateAshtakavarga,
  calculateBhinnashtakavarga,
  calculatePrasthara,
} from "@/lib/astrology/charts/ashtakavarga";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { ChartDataError } from "@/lib/astrology/charts/types";

const chartFrom = (longitudes: Record<string, number>, ascendant = 12.5, ascendantSign = "Aries") =>
  createRashiChart({
    ascendant: { sign: ascendantSign, degree: ascendant },
    planets: Object.entries(longitudes).map(([planet, longitude]) => ({
      planet: planet as never,
      longitude,
      retrograde: false,
    })),
  });

const SAMPLE = {
  Sun: 25.4,
  Moon: 118.9,
  Mars: 201.75,
  Mercury: 13.2,
  Jupiter: 276.3,
  Venus: 44.8,
  Saturn: 310.05,
  Rahu: 95.2,
  Ketu: 275.2,
};

describe("ashtakavarga", () => {
  const chart = chartFrom(SAMPLE);

  it("holds a sheet for the seven planets only", () => {
    expect(ASHTAKAVARGA_PLANETS).toEqual([
      "Sun",
      "Moon",
      "Mars",
      "Mercury",
      "Jupiter",
      "Venus",
      "Saturn",
    ]);
    // The nodes take no part in the classical system.
    expect(ASHTAKAVARGA_PLANETS).not.toContain("Rahu");
    expect(ASHTAKAVARGA_PLANETS).not.toContain("Ketu");
  });

  it("counts eight contributors: seven planets and the Lagna", () => {
    expect(CONTRIBUTORS).toHaveLength(8);
    expect(CONTRIBUTORS.at(-1)).toBe("Lagna");
  });

  /**
   * The sharpest check on the benefic tables. A planet's total is a constant of
   * the system - each contributor awards a fixed number of points wherever it
   * sits - so a mistyped house changes a total and is caught here rather than
   * silently shifting one sign's score.
   */
  it("reproduces the classical total for every planet", () => {
    for (const planet of ASHTAKAVARGA_PLANETS) {
      expect(calculateBhinnashtakavarga(chart, planet).total).toBe(CLASSICAL_TOTALS[planet]);
    }
  });

  it("sums to 337 across the Sarvashtakavarga", () => {
    expect(calculateAshtakavarga(chart).sarvaTotal).toBe(CLASSICAL_SARVA_TOTAL);
    expect(Object.values(CLASSICAL_TOTALS).reduce((a, b) => a + b, 0)).toBe(CLASSICAL_SARVA_TOTAL);
  });

  it("keeps those totals for any chart whatsoever", () => {
    // Totals are independent of placement, so a wildly different chart must
    // still produce them. If it does not, the loop is double counting.
    for (let shift = 0; shift < 360; shift += 37) {
      const shifted = chartFrom(
        Object.fromEntries(Object.entries(SAMPLE).map(([planet, longitude]) => [planet, (longitude + shift) % 360])),
        (shift / 12) % 30,
      );

      const result = calculateAshtakavarga(shifted);
      expect(result.sarvaTotal).toBe(CLASSICAL_SARVA_TOTAL);

      for (const sheet of result.bhinna) {
        expect(sheet.total).toBe(CLASSICAL_TOTALS[sheet.planet]);
      }
    }
  });

  it("gives every sign a bindu count between 0 and 8", () => {
    for (const sheet of calculateAshtakavarga(chart).bhinna) {
      for (let sign = 1; sign <= 12; sign += 1) {
        expect(sheet.bindus[sign]).toBeGreaterThanOrEqual(0);
        expect(sheet.bindus[sign]).toBeLessThanOrEqual(8);
      }
    }
  });

  it("covers all twelve signs in the Sarvashtakavarga", () => {
    const { sarva } = calculateAshtakavarga(chart);
    expect(Object.keys(sarva)).toHaveLength(12);
    for (let sign = 1; sign <= 12; sign += 1) {
      expect(sarva[sign]).toBeGreaterThanOrEqual(0);
      // Seven sheets of at most 8 each.
      expect(sarva[sign]).toBeLessThanOrEqual(56);
    }
  });

  it("adds the seven sheets sign by sign", () => {
    const result = calculateAshtakavarga(chart);
    for (let sign = 1; sign <= 12; sign += 1) {
      const expected = result.bhinna.reduce((sum, sheet) => sum + sheet.bindus[sign], 0);
      expect(result.sarva[sign]).toBe(expected);
    }
  });

  it("counts the first house as the contributor's own sign", () => {
    // Everything in Aries, Lagna in Aries. In the Sun's own row the 1st house
    // is a benefic place, so Aries must receive a point from the Sun itself.
    const stacked = chartFrom({
      Sun: 5,
      Moon: 5,
      Mars: 5,
      Mercury: 5,
      Jupiter: 5,
      Venus: 5,
      Saturn: 5,
    }, 5);

    const sun = calculateBhinnashtakavarga(stacked, "Sun");
    // Sun, Mars and Saturn each give the 1st; Moon, Mercury, Jupiter, Venus and
    // the Lagna do not.
    expect(sun.bindus[1]).toBe(3);
    expect(sun.total).toBe(CLASSICAL_TOTALS.Sun);
  });

  it("moves the whole sheet when the chart rotates", () => {
    const base = calculateBhinnashtakavarga(chartFrom(SAMPLE, 5, "Aries"), "Jupiter");
    // All eight contributors advance one sign - the Lagna included, which is
    // why the ascendant sign moves to Taurus and not only its degree.
    const rotated = calculateBhinnashtakavarga(
      chartFrom(
        Object.fromEntries(Object.entries(SAMPLE).map(([p, l]) => [p, (l + 30) % 360])),
        5,
        "Taurus",
      ),
      "Jupiter",
    );

    // Every contributor advanced one sign, so every bindu should too.
    for (let sign = 1; sign <= 12; sign += 1) {
      expect(rotated.bindus[(sign % 12) + 1]).toBe(base.bindus[sign]);
    }
  });

  it("refuses to calculate without a planet it needs", () => {
    const missingSaturn = chartFrom({
      Sun: 25.4,
      Moon: 118.9,
      Mars: 201.75,
      Mercury: 13.2,
      Jupiter: 276.3,
      Venus: 44.8,
    });

    expect(() => calculateAshtakavarga(missingSaturn)).toThrow(ChartDataError);
    expect(() => calculateAshtakavarga(missingSaturn)).toThrow(/Saturn/);
  });

  it("ignores the nodes even when they are present", () => {
    const withNodes = calculateAshtakavarga(chart);
    const withoutNodes = calculateAshtakavarga(
      chartFrom({
        Sun: SAMPLE.Sun,
        Moon: SAMPLE.Moon,
        Mars: SAMPLE.Mars,
        Mercury: SAMPLE.Mercury,
        Jupiter: SAMPLE.Jupiter,
        Venus: SAMPLE.Venus,
        Saturn: SAMPLE.Saturn,
      }),
    );

    expect(withNodes.sarva).toEqual(withoutNodes.sarva);
  });
});

describe("prasthara", () => {
  const chart = chartFrom(SAMPLE);

  it("has a row per contributor", () => {
    const grid = calculatePrasthara(chart, "Jupiter");
    expect(grid.rows).toHaveLength(8);
    expect(grid.rows.map((row) => row.contributor)).toEqual([...CONTRIBUTORS]);
  });

  it("marks each cell as given or not given, never a count", () => {
    for (const row of calculatePrasthara(chart, "Sun").rows) {
      for (let sign = 1; sign <= 12; sign += 1) {
        expect([0, 1]).toContain(row.bindus[sign]);
      }
    }
  });

  /**
   * The grid is the Bhinnashtakavarga with its working shown, so the columns
   * must add up to that sheet exactly. If they ever diverge, one of the two is
   * reading the tables differently.
   */
  it("has columns summing to the Bhinnashtakavarga", () => {
    for (const planet of ASHTAKAVARGA_PLANETS) {
      const grid = calculatePrasthara(chart, planet);
      const sheet = calculateBhinnashtakavarga(chart, planet);

      for (let sign = 1; sign <= 12; sign += 1) {
        expect(grid.columnTotals[sign]).toBe(sheet.bindus[sign]);
      }
      expect(grid.total).toBe(CLASSICAL_TOTALS[planet]);
    }
  });

  it("gives each contributor the fixed number of bindus its table holds", () => {
    // A contributor's row total is a constant of the system, like the sheet
    // totals - it cannot depend on where anything sits.
    const first = calculatePrasthara(chart, "Saturn");
    const rotated = calculatePrasthara(chartFrom(
      Object.fromEntries(Object.entries(SAMPLE).map(([p, l]) => [p, (l + 97) % 360])),
    ), "Saturn");

    for (let index = 0; index < first.rows.length; index += 1) {
      expect(rotated.rows[index].total).toBe(first.rows[index].total);
    }
  });
});
