import { describe, expect, it } from "vitest";
import {
  YOGINIS,
  YOGINI_CYCLE_YEARS,
  buildYoginiTimeline,
  yoginiAt,
  yoginiIndexFor,
} from "@/lib/astrology/charts/yogini-dasha";

const BIRTH = new Date("1992-08-14T01:05:00.000Z");

describe("yogini dasha", () => {
  it("has eight yoginis running one to eight years", () => {
    expect(YOGINIS).toHaveLength(8);
    expect(YOGINIS.map((entry) => entry.years)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("completes a cycle in thirty-six years", () => {
    const total = YOGINIS.reduce((sum, entry) => sum + entry.years, 0);
    expect(total).toBe(YOGINI_CYCLE_YEARS);
    expect(total).toBe(36);
  });

  it("starts Ashwini in Mangala", () => {
    // The +3 offset is what puts nakshatra 1 in the first yogini.
    expect(yoginiIndexFor(1)).toBe(3 % 8);
    expect(YOGINIS[yoginiIndexFor(1)].name).toBe("Bhramari");
  });

  it("advances one yogini per nakshatra and wraps after eight", () => {
    for (let nakshatra = 1; nakshatra <= 27; nakshatra += 1) {
      const index = yoginiIndexFor(nakshatra);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
      expect(yoginiIndexFor(nakshatra + 8)).toBe(index);
    }
  });

  it("runs the periods in order and without gaps", () => {
    const timeline = buildYoginiTimeline(BIRTH, 123.4);

    for (let index = 1; index < timeline.periods.length; index += 1) {
      // Each period begins exactly where the last ended.
      expect(timeline.periods[index].start.getTime()).toBe(timeline.periods[index - 1].end.getTime());
    }
  });

  it("cycles the eight in sequence", () => {
    const timeline = buildYoginiTimeline(BIRTH, 0);
    const names = timeline.periods.slice(0, 8).map((period) => period.yogini);
    expect(new Set(names).size).toBe(8);
    // The ninth returns to the first.
    expect(timeline.periods[8].yogini).toBe(timeline.periods[0].yogini);
  });

  it("gives each period its own length in years", () => {
    for (const period of buildYoginiTimeline(BIRTH, 200).periods) {
      const days = (period.end.getTime() - period.start.getTime()) / 86400000;
      expect(days).toBeCloseTo(period.years * 365.25, 6);
    }
  });

  it("reports a balance no longer than the starting period", () => {
    for (let longitude = 0; longitude < 360; longitude += 7.3) {
      const timeline = buildYoginiTimeline(BIRTH, longitude);
      const first = YOGINIS.find((entry) => entry.name === timeline.birthYogini)!;

      expect(timeline.balanceYears).toBeGreaterThan(0);
      expect(timeline.balanceYears).toBeLessThanOrEqual(first.years);
    }
  });

  it("has the birth fall inside the first period", () => {
    const timeline = buildYoginiTimeline(BIRTH, 123.4);
    expect(BIRTH >= timeline.periods[0].start).toBe(true);
    expect(BIRTH < timeline.periods[0].end).toBe(true);
    expect(yoginiAt(timeline, BIRTH)?.yogini).toBe(timeline.birthYogini);
  });

  it("spans three full cycles by default", () => {
    const timeline = buildYoginiTimeline(BIRTH, 50);
    expect(timeline.periods).toHaveLength(24);

    const span =
      (timeline.periods.at(-1)!.end.getTime() - timeline.periods[0].start.getTime()) / 86400000;
    expect(span).toBeCloseTo(3 * YOGINI_CYCLE_YEARS * 365.25, 6);
  });
});
