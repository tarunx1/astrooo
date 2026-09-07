import { describe, expect, it } from "vitest";
import { computeChartForBirth } from "@/lib/astrology/engine/chart";
import {
  DASHA_YEAR_DAYS,
  buildDashaTimeline,
  dashaChainAt,
  formatBalance,
} from "@/lib/astrology/engine/dasha";
import { VIMSHOTTARI_SEQUENCE, VIMSHOTTARI_TOTAL_YEARS } from "@/lib/astrology/kp/vimshottari";

/**
 * Vimshottari dasha.
 *
 * The timeline pivots entirely on how far the Moon had crossed its nakshatra
 * at birth, so a small error in one longitude moves every period of a life. It
 * is checked against the four charts the former provider calculated, and
 * against the structural facts that the cycle is 120 years and leaves no gaps.
 */
const KOLKATA = { timezone: "Asia/Kolkata" };

const CASES = [
  { date: "2001-11-27", time: "20:30", latitude: 31.634, longitude: 74.8723, maha: "Ketu", antar: "Venus" },
  { date: "1992-08-14", time: "06:35", latitude: 31.634, longitude: 74.8723, maha: "Mars", antar: "Venus" },
  { date: "1994-04-12", time: "07:30", latitude: 28.613939, longitude: 77.209023, maha: "Ketu", antar: "Saturn" },
  { date: "2001-11-27", time: "20:30", latitude: 31.75063, longitude: 75.75562, maha: "Ketu", antar: "Venus" },
] as const;

function timelineFor(testCase: (typeof CASES)[number], depth = 3) {
  const chart = computeChartForBirth(
    { dateOfBirth: testCase.date, timeOfBirth: testCase.time },
    { ...KOLKATA, latitude: testCase.latitude, longitude: testCase.longitude },
  );
  const moon = chart.planets.find((planet) => planet.planet === "Moon")!;
  return { chart, timeline: buildDashaTimeline(chart.instant, moon.longitude, depth) };
}

describe("Vimshottari dasha", () => {
  for (const testCase of CASES) {
    it(`gives the dasha the provider gave for ${testCase.date} ${testCase.time}`, () => {
      const { chart, timeline } = timelineFor(testCase);
      const chain = dashaChainAt(timeline, chart.instant);

      expect(chain[0].lord).toBe(testCase.maha);
      expect(chain[1].lord).toBe(testCase.antar);
      expect(chain).toHaveLength(3);
    });
  }

  it("runs one full 120-year cycle with no gaps at any level", () => {
    const { timeline } = timelineFor(CASES[0]);

    const first = timeline.periods[0];
    const last = timeline.periods[timeline.periods.length - 1];
    const years = (last.end.getTime() - first.start.getTime()) / 86400000 / DASHA_YEAR_DAYS;
    expect(years).toBeCloseTo(VIMSHOTTARI_TOTAL_YEARS, 6);

    const walk = (periods: typeof timeline.periods) => {
      for (let index = 1; index < periods.length; index += 1) {
        // Exactly equal, not merely close: a gap here would leave an instant
        // belonging to no period at all.
        expect(periods[index].start.getTime()).toBe(periods[index - 1].end.getTime());
      }
      for (const period of periods) {
        if (period.periods) {
          expect(period.periods[0].start.getTime()).toBe(period.start.getTime());
          expect(period.periods[period.periods.length - 1].end.getTime()).toBe(period.end.getTime());
          walk(period.periods);
        }
      }
    };
    walk(timeline.periods);
  });

  it("keeps the lords in sequence, starting each level from its own lord", () => {
    const { timeline } = timelineFor(CASES[0]);
    const order = VIMSHOTTARI_SEQUENCE.map((entry) => entry.lord);

    const rotationFrom = (lord: string) => {
      const start = order.indexOf(lord as (typeof order)[number]);
      return Array.from({ length: 9 }, (_, index) => order[(start + index) % 9]);
    };

    expect(timeline.periods.map((period) => period.lord)).toEqual(rotationFrom(timeline.birthLord));
    for (const period of timeline.periods) {
      expect(period.periods!.map((sub) => sub.lord)).toEqual(rotationFrom(period.lord));
    }
  });

  it("gives each mahadasha its proportional share of the cycle", () => {
    const { timeline } = timelineFor(CASES[0]);
    for (const period of timeline.periods) {
      const years = (period.end.getTime() - period.start.getTime()) / 86400000 / DASHA_YEAR_DAYS;
      const expected = VIMSHOTTARI_SEQUENCE.find((entry) => entry.lord === period.lord)!.years;
      expect(years).toBeCloseTo(expected, 4);
    }
  });

  it("starts the birth period before the birth, and reports what is left", () => {
    const { chart, timeline } = timelineFor(CASES[0]);
    const first = timeline.periods[0];

    // The first period is entered part-way through: it began before birth.
    expect(first.start.getTime()).toBeLessThan(chart.instant.getTime());
    expect(first.end.getTime()).toBeGreaterThan(chart.instant.getTime());

    const remainingYears = (first.end.getTime() - chart.instant.getTime()) / 86400000 / DASHA_YEAR_DAYS;
    expect(remainingYears).toBeCloseTo(timeline.balanceYears, 6);

    const total = VIMSHOTTARI_SEQUENCE.find((entry) => entry.lord === timeline.birthLord)!.years;
    expect(timeline.balanceYears).toBeGreaterThan(0);
    expect(timeline.balanceYears).toBeLessThanOrEqual(total);
  });

  it("puts a Moon at the very start of a nakshatra at the start of its lord's period", () => {
    // Ashwini begins at zero and is ruled by Ketu, so a Moon there has the
    // whole seven years of Ketu ahead of it.
    const timeline = buildDashaTimeline(new Date("2000-01-01T00:00:00Z"), 0, 1);
    expect(timeline.birthLord).toBe("Ketu");
    expect(timeline.balanceYears).toBeCloseTo(7, 9);
    expect(timeline.periods[0].start.getTime()).toBe(new Date("2000-01-01T00:00:00Z").getTime());
  });

  it("repeats the nine lords across the twenty-seven nakshatras", () => {
    const at = (nakshatraIndex: number) =>
      buildDashaTimeline(new Date("2000-01-01T00:00:00Z"), nakshatraIndex * (360 / 27) + 0.001, 1).birthLord;

    for (let index = 0; index < 27; index += 1) {
      expect(at(index)).toBe(VIMSHOTTARI_SEQUENCE[index % 9].lord);
    }
  });

  it("finds the period containing any instant in the cycle", () => {
    const { timeline } = timelineFor(CASES[0]);
    const start = timeline.periods[0].start.getTime();
    const end = timeline.periods[timeline.periods.length - 1].end.getTime();

    for (let fraction = 0.01; fraction < 1; fraction += 0.07) {
      const at = new Date(start + (end - start) * fraction);
      const chain = dashaChainAt(timeline, at);
      expect(chain).toHaveLength(3);
      for (const period of chain) {
        expect(at.getTime()).toBeGreaterThanOrEqual(period.start.getTime());
        expect(at.getTime()).toBeLessThan(period.end.getTime());
      }
    }
  });

  it("formats a balance as years, months and days", () => {
    expect(formatBalance(0)).toBe("0y 0m 0d");
    expect(formatBalance(7)).toBe("7y 0m 0d");
    expect(formatBalance(2.5)).toMatch(/^2y 6m \d+d$/);
  });
});
