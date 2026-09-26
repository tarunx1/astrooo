import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NorthIndianChart } from "@/components/astrology/north-indian-chart";
import { createKpChartDisplay } from "@/lib/astrology/charts/kp";
import { computeKpChartForBirth } from "@/lib/astrology/kp/chart";

const chart = computeKpChartForBirth(
  { dateOfBirth: "2001-11-27", timeOfBirth: "20:30" },
  { latitude: 31.634, longitude: 74.8723, timezone: "Asia/Kolkata" },
);

describe("KP chart display", () => {
  it("preserves cusp signs and places every planet in its Placidus house exactly once", () => {
    const display = createKpChartDisplay(chart);
    expect(display.houses).toHaveLength(12);
    expect(display.houses.flatMap((house) => house.planets)).toHaveLength(9);
    for (const cusp of chart.cusps) {
      expect(display.houses[cusp.house - 1].signName).toBe(cusp.sign);
    }
    for (const planet of chart.planets) {
      const occupied = display.houses.filter((house) => house.planets.some((item) => item.planet === planet.planet));
      expect(occupied.map((house) => house.house)).toEqual([planet.house]);
    }
    const moved = chart.planets.filter((planet) => planet.house !== planet.wholeSignHouse);
    expect(moved.length).toBeGreaterThan(0);
    for (const planet of moved) {
      expect(display.houses[planet.wholeSignHouse - 1].planets.some((item) => item.planet === planet.planet)).toBe(false);
    }
  });

  it("keeps original sign degrees and retrograde flags when a planet changes house", () => {
    const original = JSON.stringify(chart);
    const { data } = createKpChartDisplay(chart);
    for (const planet of chart.planets) {
      expect(data.planets.find((item) => item.planet === planet.planet)).toMatchObject({
        longitude: planet.longitude,
        degreeInSign: planet.degreeInSign,
        retrograde: planet.retrograde,
      });
    }
    expect(JSON.stringify(chart)).toBe(original);
  });

  it("renders the supplied cusp placements instead of recomputing whole-sign houses", () => {
    const { data, houses } = createKpChartDisplay(chart);
    const kp = renderToStaticMarkup(<NorthIndianChart data={data} houses={houses} showDegrees titleId="kp" />);
    const rashi = renderToStaticMarkup(<NorthIndianChart data={data} showDegrees titleId="kp" />);
    expect(kp).toContain('role="img"');
    expect(kp).not.toEqual(rashi);
    expect(kp).not.toContain("NaN");
  });
});
