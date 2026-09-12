import { describe, expect, it } from "vitest";
import { SIGNS } from "@/config/astrology";
import { buildHouses, getHouseFromSign, getHouseSign, groupPlanetsByHouse, sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import {
  getNavamsaDegree,
  getNavamsaIndex,
  getNavamsaSign,
  getNavamsaStartSign,
} from "@/lib/astrology/charts/navamsa";
import {
  formatDegreeInSign,
  getDegreeInSign,
  getSignName,
  getSignNumber,
  getSignNumberFromName,
  normalizeLongitude,
  normalizeSign,
} from "@/lib/astrology/charts/signs";
import { ChartDataError, type ChartPlanet } from "@/lib/astrology/charts/types";
import {
  createMoonChart,
  createNavamsaChart,
  createRashiChart,
  createTransitChart,
  validateChartPlanets,
} from "@/lib/astrology/charts/factory";

/**
 * The chart engine.
 *
 * This is the layer that decides where a planet appears, so it is tested
 * exhaustively rather than by example: every ascendant against every sign, and
 * every navamsa boundary. Placement is cheap to test and expensive to get
 * subtly wrong, because a one-house error still looks like a plausible chart.
 */
const planet = (name: ChartPlanet["planet"], longitude: number, retrograde = false): ChartPlanet => ({
  planet: name,
  longitude,
  sign: getSignNumber(longitude),
  degreeInSign: getDegreeInSign(longitude),
  retrograde,
});

describe("longitude normalisation", () => {
  it("wraps any value into 0 <= longitude < 360", () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [-1, 359],
      [359.999, 359.999],
      [360, 0],
      [720, 0],
      [-720, 0],
      [-361, 359],
      [450, 90],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeLongitude(input), String(input)).toBeCloseTo(expected, 6);
    }
  });

  it("refuses values that cannot describe a position", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => normalizeLongitude(bad)).toThrow(ChartDataError);
    }
  });
});

describe("sign derivation", () => {
  it("places the documented boundaries in the right sign", () => {
    const cases: Array<[number, number]> = [
      [0, 1], [29.999, 1], [30, 2], [59.999, 2], [60, 3],
      [89, 3], [180, 7], [359.9, 12], [360, 1], [-1, 12],
    ];
    for (const [longitude, sign] of cases) {
      expect(getSignNumber(longitude), `${longitude}°`).toBe(sign);
    }
  });

  it("gives every sign a 30 degree span", () => {
    for (let sign = 1; sign <= 12; sign += 1) {
      const start = (sign - 1) * 30;
      expect(getSignNumber(start)).toBe(sign);
      expect(getSignNumber(start + 29.9999)).toBe(sign);
      expect(getDegreeInSign(start)).toBeCloseTo(0, 6);
      expect(getDegreeInSign(start + 15)).toBeCloseTo(15, 6);
    }
  });

  it("round-trips names and numbers", () => {
    SIGNS.forEach((name, index) => {
      expect(getSignNumberFromName(name)).toBe(index + 1);
      expect(getSignName(index + 1)).toBe(name);
    });
    expect(getSignNumberFromName(" scorpio ")).toBe(8);
    expect(() => getSignNumberFromName("Ophiuchus")).toThrow(ChartDataError);
  });

  it("wraps sign arithmetic back into 1-12", () => {
    expect(normalizeSign(13)).toBe(1);
    expect(normalizeSign(0)).toBe(12);
    expect(normalizeSign(-1)).toBe(11);
    expect(normalizeSign(25)).toBe(1);
  });

  it("never prints a degree that reads as the next sign", () => {
    // 29°59.7' must not round up to 30°00'.
    expect(formatDegreeInSign(29.995)).toBe("29°59'");
    expect(formatDegreeInSign(0)).toBe("00°00'");
    expect(formatDegreeInSign(12.5666)).toBe("12°33'");
  });
});

describe("house formation", () => {
  it("matches the worked Scorpio example", () => {
    // Ascendant Scorpio (8): house 1 is Scorpio, and the signs follow in order.
    const expected = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
    for (let house = 1; house <= 12; house += 1) {
      expect(getHouseSign(8, house), `house ${house}`).toBe(expected[house - 1]);
    }
  });

  it("is exhaustively consistent across all 144 ascendant and sign pairs", () => {
    for (let ascendant = 1; ascendant <= 12; ascendant += 1) {
      const seen = new Set<number>();

      for (let house = 1; house <= 12; house += 1) {
        const sign = getHouseSign(ascendant, house);

        expect(sign).toBeGreaterThanOrEqual(1);
        expect(sign).toBeLessThanOrEqual(12);
        seen.add(sign);

        // The two directions must agree: the sign in a house maps back to it.
        expect(getHouseFromSign(sign, ascendant)).toBe(house);
      }

      // Every sign appears exactly once per chart.
      expect(seen.size).toBe(12);
    }
  });

  it("always returns a house between 1 and 12", () => {
    for (let ascendant = 1; ascendant <= 12; ascendant += 1) {
      for (let sign = 1; sign <= 12; sign += 1) {
        const house = getHouseFromSign(sign, ascendant);
        expect(house, `asc ${ascendant} sign ${sign}`).toBeGreaterThanOrEqual(1);
        expect(house).toBeLessThanOrEqual(12);
      }
    }
  });

  it("puts the ascendant's own sign in the first house", () => {
    for (let ascendant = 1; ascendant <= 12; ascendant += 1) {
      expect(getHouseFromSign(ascendant, ascendant)).toBe(1);
      expect(getHouseSign(ascendant, 1)).toBe(ascendant);
    }
  });

  it("places the worked Moon example in the third house", () => {
    // Ascendant Scorpio (8), Moon in Capricorn (10) -> third house.
    expect(getHouseFromSign(10, 8)).toBe(3);
  });
});

describe("planet grouping", () => {
  const chart = {
    chartType: "D1",
    ascendantSign: 8,
    planets: [
      planet("Saturn", 15),
      planet("Sun", 285),
      planet("Moon", 15.5),
      planet("Rahu", 100),
      planet("Ketu", 280),
    ],
  };

  it("orders planets traditionally, never by arrival", () => {
    const shuffled = sortPlanetsForDisplay([...chart.planets].reverse());
    expect(shuffled.map((p) => p.planet)).toEqual(["Sun", "Moon", "Saturn", "Rahu", "Ketu"]);
  });

  it("keeps every planet and every house", () => {
    const grouped = groupPlanetsByHouse(chart);

    expect(Object.keys(grouped)).toHaveLength(12);
    const placed = Object.values(grouped).flat();
    expect(placed).toHaveLength(chart.planets.length);
    expect(new Set(placed.map((p) => p.planet)).size).toBe(chart.planets.length);
  });

  it("builds twelve houses with each sign used once", () => {
    const houses = buildHouses(chart);
    expect(houses).toHaveLength(12);
    expect(new Set(houses.map((h) => h.sign)).size).toBe(12);
    expect(houses[0].sign).toBe(8);
    expect(houses[0].signName).toBe("Scorpio");
  });
});

describe("navamsa", () => {
  it("splits each sign into nine equal parts", () => {
    // 3°20' each, so the eight boundaries fall at these degrees.
    const boundaries = [0, 3 + 20 / 60, 6 + 40 / 60, 10, 13 + 20 / 60, 16 + 40 / 60, 20, 23 + 20 / 60, 26 + 40 / 60];

    boundaries.forEach((degree, index) => {
      expect(getNavamsaIndex(degree), `${degree}°`).toBe(index);
      // Just inside the part, and just before the next boundary.
      expect(getNavamsaIndex(degree + 0.5)).toBe(index);
    });

    expect(getNavamsaIndex(29.9999)).toBe(8);
  });

  it("does not slip a navamsa at a boundary through floating point", () => {
    // 3°20' is not exact in binary; a value a hair under must not fall early.
    for (let index = 1; index < 9; index += 1) {
      const boundary = index * (30 / 9);
      expect(getNavamsaIndex(boundary), `boundary ${index}`).toBe(index);
      expect(getNavamsaIndex(boundary - 1e-12)).toBe(index);
      expect(getNavamsaIndex(boundary + 1e-9)).toBe(index);
    }
  });

  it("starts movable signs from themselves", () => {
    for (const sign of [1, 4, 7, 10]) {
      expect(getNavamsaStartSign(sign), `sign ${sign}`).toBe(sign);
    }
    // Aries 0° is the first navamsa of Aries.
    expect(getNavamsaSign(0)).toBe(1);
    // Aries 29°59' is the ninth navamsa from Aries: Sagittarius.
    expect(getNavamsaSign(29.99)).toBe(9);
  });

  it("starts fixed signs from the ninth from themselves", () => {
    expect(getNavamsaStartSign(2)).toBe(10); // Taurus -> Capricorn
    expect(getNavamsaStartSign(5)).toBe(1); // Leo -> Aries
    expect(getNavamsaStartSign(8)).toBe(4); // Scorpio -> Cancer
    expect(getNavamsaStartSign(11)).toBe(7); // Aquarius -> Libra

    // Taurus 0° falls in Capricorn.
    expect(getNavamsaSign(30)).toBe(10);
  });

  it("starts dual signs from the fifth from themselves", () => {
    expect(getNavamsaStartSign(3)).toBe(7); // Gemini -> Libra
    expect(getNavamsaStartSign(6)).toBe(10); // Virgo -> Capricorn
    expect(getNavamsaStartSign(9)).toBe(1); // Sagittarius -> Aries
    expect(getNavamsaStartSign(12)).toBe(4); // Pisces -> Cancer

    // Gemini 0° falls in Libra.
    expect(getNavamsaSign(60)).toBe(7);
  });

  it("spreads the position inside a navamsa across the whole navamsa sign", () => {
    // Aries 0° opens the first navamsa, so it opens the navamsa sign too.
    expect(getNavamsaDegree(0)).toBeCloseTo(0, 9);
    // Half way through the first navamsa (1°40') is half way through the sign.
    expect(getNavamsaDegree(30 / 18)).toBeCloseTo(15, 9);
    // A hair before the next navamsa is a hair before the next sign, never past
    // it - printing 30° would read as a sign the planet is not in.
    expect(getNavamsaDegree(30 / 9 - 1e-9)).toBeLessThan(30);
    // Every navamsa restarts at zero, whatever sign it began from.
    for (let index = 0; index < 9; index += 1) {
      expect(getNavamsaDegree(index * (30 / 9)), `navamsa ${index}`).toBeCloseTo(0, 6);
    }
  });

  it("never reports a navamsa degree outside its sign, at any longitude", () => {
    for (let longitude = 0; longitude < 360; longitude += 0.37) {
      const degree = getNavamsaDegree(longitude);
      expect(degree, `${longitude}°`).toBeGreaterThanOrEqual(0);
      expect(degree, `${longitude}°`).toBeLessThanOrEqual(30);
    }
  });

  it("covers all nine navamsas of a sign without repeating", () => {
    for (let sign = 1; sign <= 12; sign += 1) {
      const base = (sign - 1) * 30;
      const produced = Array.from({ length: 9 }, (_, index) => getNavamsaSign(base + index * (30 / 9) + 0.1));
      expect(new Set(produced).size, `sign ${sign}`).toBe(9);
    }
  });
});

describe("chart factories", () => {
  const source = {
    ascendant: { sign: "Scorpio", degree: 10 },
    planets: [
      { planet: "Sun" as const, longitude: 15, retrograde: false },
      { planet: "Moon" as const, longitude: 42, retrograde: false },
      { planet: "Saturn" as const, longitude: 95, retrograde: true },
      { planet: "Rahu" as const, longitude: 100, retrograde: false },
      { planet: "Ketu" as const, longitude: 280, retrograde: false },
    ],
  };

  it("derives signs and degrees from longitude, not from labels", () => {
    const chart = createRashiChart(source);

    expect(chart.ascendantSign).toBe(8);
    expect(chart.ascendantLongitude).toBeCloseTo(220, 6); // Scorpio starts at 210

    const moon = chart.planets.find((p) => p.planet === "Moon")!;
    expect(moon.sign).toBe(2); // 42° is Taurus
    expect(moon.degreeInSign).toBeCloseTo(12, 6);

    const saturn = chart.planets.find((p) => p.planet === "Saturn")!;
    expect(saturn.sign).toBe(4); // 95° is Cancer
    expect(saturn.retrograde).toBe(true);
  });

  it("builds the Navamsa from longitudes and its own ascendant", () => {
    const navamsa = createNavamsaChart(createRashiChart(source));

    expect(navamsa.chartType).toBe("D9");
    // Ascendant 220° = Scorpio 10°, third navamsa of a fixed sign starting at
    // Cancer -> Virgo.
    expect(navamsa.ascendantSign).toBe(getNavamsaSign(220));
    expect(navamsa.planets).toHaveLength(source.planets.length);
    // The source longitude is preserved so the degree stays inspectable.
    expect(navamsa.planets.find((p) => p.planet === "Moon")!.longitude).toBe(42);
  });

  it("refuses a Navamsa without an exact ascendant degree", () => {
    const chart = createRashiChart({ ascendant: { sign: "Scorpio" }, planets: source.planets });
    expect(() => createNavamsaChart(chart)).toThrow(ChartDataError);
  });

  it("puts the Moon in the first house of a Moon chart", () => {
    const moonChart = createMoonChart(createRashiChart(source));

    expect(moonChart.ascendantSign).toBe(2); // Moon in Taurus
    expect(getHouseFromSign(2, moonChart.ascendantSign)).toBe(1);
  });

  it("reports inconsistent nodes without rewriting them", () => {
    const chart = createRashiChart(source);
    const warnings = validateChartPlanets(chart.planets);

    // 100° and 280° are exactly opposite, so this set is consistent.
    expect(warnings).toHaveLength(0);

    const broken = createRashiChart({
      ...source,
      planets: [...source.planets.slice(0, 4), { planet: "Ketu" as const, longitude: 200, retrograde: false }],
    });
    const brokenWarnings = validateChartPlanets(broken.planets);
    expect(brokenWarnings.join(" ")).toMatch(/Rahu and Ketu/);
    // The value itself is untouched.
    expect(broken.planets.find((p) => p.planet === "Ketu")!.longitude).toBe(200);
  });
});

/**
 * Gochar.
 *
 * The thing that makes a transit chart a reading rather than an almanac is the
 * natal reference point, so that is what these check: the same sky, read from
 * two different birth charts, must produce two different house placements.
 */
describe("transit chart", () => {
  const transits = [
    { planet: "Sun" as const, longitude: 155.4 },
    { planet: "Saturn" as const, longitude: 340.2, retrograde: true },
    { planet: "Jupiter" as const, longitude: 65.9 },
  ];

  it("counts houses from the natal reference, not from the transit positions", () => {
    // Natal Moon in Aries: Sun at 155.4 is in Virgo (6), so six signs along.
    const fromAries = createTransitChart({ natalAscendantSign: 1, transits });
    expect(getHouseFromSign(fromAries.planets[0].sign, fromAries.ascendantSign)).toBe(6);

    // The identical sky, read from a natal Moon in Libra, puts it in the 12th.
    const fromLibra = createTransitChart({ natalAscendantSign: 7, transits });
    expect(getHouseFromSign(fromLibra.planets[0].sign, fromLibra.ascendantSign)).toBe(12);

    // Same longitudes either way; only the reference point moved.
    expect(fromAries.planets.map((planetPosition) => planetPosition.longitude)).toEqual(
      fromLibra.planets.map((planetPosition) => planetPosition.longitude),
    );
  });

  it("places every transiting planet from every natal sign", () => {
    for (let natal = 1; natal <= SIGNS.length; natal += 1) {
      const chart = createTransitChart({ natalAscendantSign: natal, transits });

      for (const position of chart.planets) {
        const house = getHouseFromSign(position.sign, chart.ascendantSign);
        expect(house).toBeGreaterThanOrEqual(1);
        expect(house).toBeLessThanOrEqual(12);
        // The house's sign has to be the sign the planet is actually in.
        expect(getHouseSign(chart.ascendantSign, house)).toBe(position.sign);
      }
    }
  });

  it("derives sign and degree from longitude and keeps retrograde", () => {
    const chart = createTransitChart({ natalAscendantSign: 1, transits, calculatedAt: "2026-09-07T00:00:00.000Z" });

    expect(chart.chartType).toBe("GOCHAR");
    expect(chart.calculatedAt).toBe("2026-09-07T00:00:00.000Z");

    const saturn = chart.planets.find((position) => position.planet === "Saturn")!;
    expect(getSignName(saturn.sign)).toBe("Pisces");
    expect(saturn.degreeInSign).toBeCloseTo(10.2, 6);
    expect(saturn.retrograde).toBe(true);

    // Absent retrograde is false, never undefined leaking into the chart.
    expect(chart.planets.find((position) => position.planet === "Sun")!.retrograde).toBe(false);
  });

  it("normalises an out-of-range natal sign and longitude", () => {
    const chart = createTransitChart({
      natalAscendantSign: 13,
      transits: [{ planet: "Mars" as const, longitude: 380 }],
    });

    expect(chart.ascendantSign).toBe(1);
    expect(chart.planets[0].longitude).toBe(20);
    expect(chart.planets[0].sign).toBe(1);
  });
});
