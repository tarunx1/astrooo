import { describe, expect, it } from "vitest";
import { calculateBeneficNatures, moonElongation } from "@/lib/astrology/charts/benefic";
import { createRashiChart } from "@/lib/astrology/charts/factory";

const at = (sign: number, degree = 10) => (sign - 1) * 30 + degree;

const build = (positions: Record<string, number>) =>
  createRashiChart({
    ascendant: { sign: "Aries", degree: 5 },
    planets: Object.entries(positions).map(([planet, longitude]) => ({
      planet: planet as never,
      longitude,
      retrograde: false,
    })),
  });

const natureOf = (chart: ReturnType<typeof build>, planet: string) =>
  calculateBeneficNatures(chart).find((entry) => entry.planet === planet)!;

const BASE = {
  Sun: at(1),
  Moon: at(5),
  Mars: at(3),
  Mercury: at(4),
  Jupiter: at(9),
  Venus: at(7),
  Saturn: at(11),
  Rahu: at(6),
  Ketu: at(12),
};

describe("fixed natures", () => {
  const chart = build(BASE);

  it("has Jupiter and Venus benefic", () => {
    expect(natureOf(chart, "Jupiter").nature).toBe("benefic");
    expect(natureOf(chart, "Venus").nature).toBe("benefic");
  });

  it("has the Sun, Mars, Saturn and the nodes malefic", () => {
    for (const planet of ["Sun", "Mars", "Saturn", "Rahu", "Ketu"]) {
      expect(natureOf(chart, planet).nature).toBe("malefic");
    }
  });

  it("marks the fixed ones as unconditional", () => {
    for (const planet of ["Jupiter", "Venus", "Sun", "Mars", "Saturn"]) {
      expect(natureOf(chart, planet).conditional).toBe(false);
    }
  });
});

describe("the Moon by fortnight", () => {
  it("is benefic while waxing", () => {
    // Sun in Aries, Moon a quarter of the way round: waxing.
    const chart = build({ ...BASE, Sun: at(1, 0), Moon: at(4, 0) });
    const moon = natureOf(chart, "Moon");
    expect(moon.nature).toBe("benefic");
    expect(moon.conditional).toBe(true);
    expect(moon.reason).toMatch(/Waxing/);
  });

  it("is malefic while waning", () => {
    // Moon more than 180 degrees ahead of the Sun: the dark fortnight.
    const chart = build({ ...BASE, Sun: at(1, 0), Moon: at(9, 0) });
    expect(natureOf(chart, "Moon").nature).toBe("malefic");
    expect(natureOf(chart, "Moon").reason).toMatch(/Waning/);
  });

  it("measures elongation from the Sun, wrapping the zodiac", () => {
    expect(moonElongation(build({ ...BASE, Sun: at(1, 0), Moon: at(4, 0) }))).toBeCloseTo(90, 6);
    // Moon behind the Sun wraps to a large elongation, which is waning.
    expect(moonElongation(build({ ...BASE, Sun: at(4, 0), Moon: at(1, 0) }))).toBeCloseTo(270, 6);
  });

  it("turns at exactly 180 degrees", () => {
    const full = build({ ...BASE, Sun: at(1, 0), Moon: at(7, 0) });
    expect(moonElongation(full)).toBeCloseTo(180, 6);
    // 180 is no longer the bright fortnight.
    expect(natureOf(full, "Moon").nature).toBe("malefic");
  });
});

describe("Mercury by company", () => {
  it("is benefic alone", () => {
    const chart = build({ ...BASE, Mercury: at(4) });
    const mercury = natureOf(chart, "Mercury");
    expect(mercury.nature).toBe("benefic");
    expect(mercury.reason).toMatch(/Alone/);
  });

  it("is malefic sharing a sign with a malefic", () => {
    const chart = build({ ...BASE, Mercury: at(3), Mars: at(3) });
    const mercury = natureOf(chart, "Mercury");
    expect(mercury.nature).toBe("malefic");
    expect(mercury.reason).toMatch(/Mars/);
  });

  it("stays benefic with a benefic companion", () => {
    const chart = build({ ...BASE, Mercury: at(9), Jupiter: at(9) });
    expect(natureOf(chart, "Mercury").nature).toBe("benefic");
  });

  it("is always conditional", () => {
    expect(natureOf(build(BASE), "Mercury").conditional).toBe(true);
  });
});

describe("coverage", () => {
  it("classifies every planet in the chart", () => {
    const chart = build(BASE);
    const natures = calculateBeneficNatures(chart);
    expect(natures).toHaveLength(chart.planets.length);
    for (const entry of natures) {
      expect(["benefic", "malefic"]).toContain(entry.nature);
    }
  });

  it("gives a reason for exactly the two conditional planets", () => {
    const withReason = calculateBeneficNatures(build(BASE)).filter((entry) => entry.conditional);
    expect(withReason.map((entry) => entry.planet).sort()).toEqual(["Mercury", "Moon"]);
  });
});
