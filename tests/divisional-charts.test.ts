import { describe, expect, it } from "vitest";
import {
  createDivisionalChart,
  createNavamsaChart,
  createRashiChart,
  createShodashvarga,
} from "@/lib/astrology/charts/factory";
import { calculateVarga } from "@/lib/astrology/charts/varga";
import { ChartDataError } from "@/lib/astrology/charts/types";

const source = {
  ascendant: { sign: "Aries", degree: 12.5 },
  planets: [
    { planet: "Sun" as const, longitude: 25.4, retrograde: false },
    { planet: "Moon" as const, longitude: 118.9, retrograde: false },
    { planet: "Mars" as const, longitude: 201.75, retrograde: false },
    { planet: "Mercury" as const, longitude: 13.2, retrograde: true },
    { planet: "Jupiter" as const, longitude: 276.3, retrograde: false },
    { planet: "Venus" as const, longitude: 44.8, retrograde: false },
    { planet: "Saturn" as const, longitude: 310.05, retrograde: true },
    { planet: "Rahu" as const, longitude: 95.2, retrograde: true },
    { planet: "Ketu" as const, longitude: 275.2, retrograde: true },
  ],
  calculatedAt: "2026-01-01T00:00:00.000Z",
};

const rashi = createRashiChart(source);

describe("divisional charts", () => {
  it("labels each chart by its division", () => {
    expect(createDivisionalChart(rashi, 10).chartType).toBe("D10");
    expect(createDivisionalChart(rashi, 60).chartType).toBe("D60");
  });

  it("keeps every planet, with the divisional sign and a matching degree", () => {
    const d10 = createDivisionalChart(rashi, 10);
    expect(d10.planets).toHaveLength(source.planets.length);

    for (const planet of d10.planets) {
      const expected = calculateVarga(planet.longitude, 10);
      expect(planet.sign).toBe(expected.sign);
      expect(planet.degreeInSign).toBeCloseTo(expected.degreeInSign, 9);
    }
  });

  it("preserves the source longitude so the rashi degree stays inspectable", () => {
    const d30 = createDivisionalChart(rashi, 30);
    const sun = d30.planets.find((planet) => planet.planet === "Sun");
    expect(sun?.longitude).toBeCloseTo(25.4, 9);
  });

  it("carries retrograde status through unchanged", () => {
    const d9 = createDivisionalChart(rashi, 9);
    expect(d9.planets.find((planet) => planet.planet === "Mercury")?.retrograde).toBe(true);
    expect(d9.planets.find((planet) => planet.planet === "Sun")?.retrograde).toBe(false);
  });

  it("divides the ascendant rather than keeping the rashi ascendant", () => {
    const d9 = createDivisionalChart(rashi, 9);
    expect(d9.ascendantSign).toBe(calculateVarga(12.5, 9).sign);
  });

  /**
   * Two ascendants in the same sign must not produce the same D9. If they do,
   * the ascendant is being taken from the sign rather than the degree.
   */
  it("distinguishes two ascendants inside one sign", () => {
    const early = createDivisionalChart(createRashiChart({ ...source, ascendant: { sign: "Aries", degree: 2 } }), 9);
    const late = createDivisionalChart(createRashiChart({ ...source, ascendant: { sign: "Aries", degree: 28 } }), 9);
    expect(early.ascendantSign).not.toBe(late.ascendantSign);
  });

  it("returns the rashi unchanged for D1", () => {
    const d1 = createDivisionalChart(rashi, 1);
    expect(d1.ascendantSign).toBe(rashi.ascendantSign);
    expect(d1.planets.map((planet) => planet.sign)).toEqual(rashi.planets.map((planet) => planet.sign));
  });

  it("refuses a division it does not implement", () => {
    expect(() => createDivisionalChart(rashi, 5)).toThrow(/Unsupported varga/);
  });

  it("refuses to guess a varga ascendant from a sign alone", () => {
    const withoutDegree = createRashiChart({ ...source, ascendant: { sign: "Aries" } });
    expect(() => createDivisionalChart(withoutDegree, 9)).toThrow(ChartDataError);
    expect(() => createDivisionalChart(withoutDegree, 16)).toThrow(/exact degree/);
  });

  /**
   * The navamsa factory was refactored onto the generic engine. Its output must
   * be identical to the generic D9, or the refactor changed a chart.
   */
  it("leaves createNavamsaChart identical to the generic D9", () => {
    expect(createNavamsaChart(rashi)).toEqual(createDivisionalChart(rashi, 9));
  });
});

describe("shodashvarga table", () => {
  const table = createShodashvarga(rashi);

  it("covers all sixteen divisions", () => {
    expect(table.divisions.map((entry) => entry.division)).toEqual([
      1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60,
    ]);
  });

  it("has a row per planet with a sign in every division", () => {
    expect(table.rows).toHaveLength(source.planets.length);

    for (const row of table.rows) {
      for (const { division } of table.divisions) {
        const sign = row.signs[division];
        expect(sign).toBeGreaterThanOrEqual(1);
        expect(sign).toBeLessThanOrEqual(12);
      }
    }
  });

  it("agrees with the individual charts", () => {
    const d10 = createDivisionalChart(rashi, 10);

    for (const planet of d10.planets) {
      const row = table.rows.find((entry) => entry.planet === planet.planet);
      expect(row?.signs[10]).toBe(planet.sign);
    }
  });

  it("carries the ascendant across the divisions", () => {
    expect(table.ascendant[1]).toBe(rashi.ascendantSign);
    expect(table.ascendant[9]).toBe(createNavamsaChart(rashi).ascendantSign);
  });

  it("omits the ascendant row when no exact degree is known", () => {
    const withoutDegree = createRashiChart({ ...source, ascendant: { sign: "Aries" } });
    expect(createShodashvarga(withoutDegree).ascendant).toEqual({});
  });
});
