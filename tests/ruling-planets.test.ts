import { describe, expect, it } from "vitest";
import { calculateRulingPlanets } from "@/lib/astrology/kp/ruling-planets";
import { computeKpChartForBirth } from "@/lib/astrology/kp/chart";

const LOCATION = {
  latitude: 31.634,
  longitude: 74.8723,
  timezone: "Asia/Kolkata",
};

const chart = computeKpChartForBirth(
  { dateOfBirth: "1992-08-14", timeOfBirth: "06:35" },
  LOCATION,
);

describe("KP ruling planets", () => {
  const result = calculateRulingPlanets(chart);

  it("draws on all seven sources", () => {
    const sources = result.planets.flatMap((entry) => entry.sources);
    expect(sources).toHaveLength(7);
    expect(new Set(sources).size).toBe(7);
  });

  it("names the ascendant and Moon lords among them", () => {
    const sources = result.planets.flatMap((entry) => entry.sources);
    expect(sources).toContain("ascendant-sign-lord");
    expect(sources).toContain("ascendant-star-lord");
    expect(sources).toContain("ascendant-sub-lord");
    expect(sources).toContain("moon-sign-lord");
    expect(sources).toContain("moon-star-lord");
    expect(sources).toContain("moon-sub-lord");
    expect(sources).toContain("day-lord");
  });

  it("counts repeats rather than collapsing them", () => {
    for (const entry of result.planets) {
      expect(entry.strength).toBe(entry.sources.length);
      expect(entry.strength).toBeGreaterThanOrEqual(1);
    }

    const total = result.planets.reduce((sum, entry) => sum + entry.strength, 0);
    expect(total).toBe(7);
  });

  it("orders strongest first", () => {
    for (let index = 1; index < result.planets.length; index += 1) {
      expect(result.planets[index - 1].strength).toBeGreaterThanOrEqual(
        result.planets[index].strength,
      );
    }
  });

  it("uses the weekday lord for the day of birth", () => {
    // 14 August 1992 was a Friday, whose lord is Venus.
    expect(result.weekday).toBe("Friday");
    expect(result.dayLord).toBe("Venus");
  });

  it("lists no planet twice", () => {
    const names = result.planets.map((entry) => entry.planet);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives the same answer for the same moment", () => {
    const again = calculateRulingPlanets(chart);
    expect(again.planets).toEqual(result.planets);
  });
});
