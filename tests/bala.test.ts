import { describe, expect, it } from "vitest";
import {
  IMPLEMENTED_BALAS,
  MISSING_BALAS,
  SHASHTIAMSAS_PER_RUPA,
  calculateBala,
  digBala,
  drekkanaBala,
  kendradiBala,
  naisargikaBala,
  ojhayugmaBala,
  saptavargajaBala,
  SAPTAVARGAJA_MAX,
  uchchaBala,
} from "@/lib/astrology/charts/bala";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { ChartDataError } from "@/lib/astrology/charts/types";

const at = (sign: number, degree = 10) => (sign - 1) * 30 + degree;

describe("naisargika bala", () => {
  it("is a fixed ranking with the Sun strongest", () => {
    expect(naisargikaBala("Sun")).toBeCloseTo(60, 9);
    expect(naisargikaBala("Saturn")).toBeCloseTo(60 / 7, 9);
  });

  it("gives every planet an exact multiple of 60/7", () => {
    // The self-check: a mistyped value would not be a multiple.
    for (const planet of ["Sun", "Moon", "Venus", "Jupiter", "Mercury", "Mars", "Saturn"] as const) {
      const multiple = (naisargikaBala(planet) * 7) / SHASHTIAMSAS_PER_RUPA;
      expect(multiple).toBeCloseTo(Math.round(multiple), 9);
    }
  });

  it("orders the seven as the tradition does", () => {
    const order = (["Sun", "Moon", "Venus", "Jupiter", "Mercury", "Mars", "Saturn"] as const).map(
      naisargikaBala,
    );
    for (let index = 1; index < order.length; index += 1) {
      expect(order[index - 1]).toBeGreaterThan(order[index]);
    }
  });
});

describe("uchcha bala", () => {
  it("is sixty at exact exaltation", () => {
    // The Sun exalts at Aries 10.
    expect(uchchaBala("Sun", at(1, 10))).toBeCloseTo(60, 6);
  });

  it("is nothing at exact debilitation", () => {
    // Libra 10, opposite the exaltation.
    expect(uchchaBala("Sun", at(7, 10))).toBeCloseTo(0, 6);
  });

  it("is thirty a quarter turn away", () => {
    expect(uchchaBala("Sun", at(4, 10))).toBeCloseTo(30, 6);
  });

  it("never leaves the range for any longitude", () => {
    for (let longitude = 0; longitude < 360; longitude += 0.7) {
      const value = uchchaBala("Jupiter", longitude);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(60);
    }
  });
});

describe("kendradi bala", () => {
  it("scores angles, succedents and cadents", () => {
    for (const house of [1, 4, 7, 10]) expect(kendradiBala(house)).toBe(60);
    for (const house of [2, 5, 8, 11]) expect(kendradiBala(house)).toBe(30);
    for (const house of [3, 6, 9, 12]) expect(kendradiBala(house)).toBe(15);
  });
});

describe("dig bala", () => {
  it("is full at the planet's own direction", () => {
    // Jupiter is strongest at the ascendant.
    expect(digBala("Jupiter", at(1, 0), at(1, 0))).toBeCloseTo(60, 6);
    // The Sun is strongest at the tenth.
    expect(digBala("Sun", at(10, 0), at(1, 0))).toBeCloseTo(60, 6);
  });

  it("is nothing opposite it", () => {
    expect(digBala("Jupiter", at(7, 0), at(1, 0))).toBeCloseTo(0, 6);
  });

  it("stays in range everywhere", () => {
    for (let longitude = 0; longitude < 360; longitude += 1.3) {
      const value = digBala("Saturn", longitude, at(1, 0));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(60);
    }
  });
});

describe("ojhayugmarasyamsa bala", () => {
  it("gives the Moon and Venus even signs", () => {
    // Taurus is even; the navamsa of Taurus 0 is Capricorn, also even.
    expect(ojhayugmaBala("Moon", at(2, 0))).toBe(30);
  });

  it("gives every other planet odd signs", () => {
    expect(ojhayugmaBala("Sun", at(2, 0))).toBe(0);
  });

  it("never exceeds thirty", () => {
    for (let longitude = 0; longitude < 360; longitude += 1.1) {
      expect(ojhayugmaBala("Mars", longitude)).toBeLessThanOrEqual(30);
    }
  });
});

describe("drekkana bala", () => {
  it("gives male planets the first third", () => {
    expect(drekkanaBala("Sun", at(1, 5))).toBe(15);
    expect(drekkanaBala("Sun", at(1, 15))).toBe(0);
  });

  it("gives neuter planets the second and female the third", () => {
    expect(drekkanaBala("Mercury", at(1, 15))).toBe(15);
    expect(drekkanaBala("Venus", at(1, 25))).toBe(15);
  });
});

describe("calculateBala", () => {
  const chart = createRashiChart({
    ascendant: { sign: "Aries", degree: 0 },
    planets: (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const).map(
      (planet, index) => ({ planet, longitude: at(index + 1, 10), retrograde: false }),
    ),
  });

  it("returns the seven planets", () => {
    expect(calculateBala(chart)).toHaveLength(7);
  });

  it("adds only the components it actually calculated", () => {
    for (const entry of calculateBala(chart)) {
      const sum =
        entry.naisargika +
        entry.saptavargaja +
        entry.drik +
        entry.uchcha +
        entry.kendradi +
        entry.dig +
        entry.ojhayugma +
        entry.drekkana;
      expect(entry.partialTotal).toBeCloseTo(sum, 9);
    }
  });

  it("refuses without an exact ascendant, which Dig Bala needs", () => {
    const noDegree = createRashiChart({
      ascendant: { sign: "Aries" },
      planets: (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const).map(
        (planet, index) => ({ planet, longitude: at(index + 1, 10), retrograde: false }),
      ),
    });
    expect(() => calculateBala(noDegree)).toThrow(ChartDataError);
  });
});

describe("honesty about coverage", () => {
  it("names the implemented components", () => {
    expect(IMPLEMENTED_BALAS).toHaveLength(8);
  });

  it("names what is missing, so a partial total cannot pass as Shadbala", () => {
    expect(MISSING_BALAS.length).toBeGreaterThan(0);
    expect(MISSING_BALAS.join(" ")).toMatch(/Kala Bala/);
    expect(MISSING_BALAS.join(" ")).toMatch(/Chesta Bala/);
  });

  it("exposes no shadbala total", async () => {
    const balaModule = await import("@/lib/astrology/charts/bala");
    expect("shadbalaTotal" in balaModule).toBe(false);
    expect("calculateShadbala" in balaModule).toBe(false);
  });
});

describe("saptavargaja bala", () => {
  const signsOf = (chart: ReturnType<typeof createRashiChart>) => {
    const map: Record<string, number> = {};
    for (const planet of chart.planets) map[planet.planet] = planet.sign;
    return map;
  };

  const chart = createRashiChart({
    ascendant: { sign: "Aries", degree: 0 },
    planets: (["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const).map(
      (planet, index) => ({ planet, longitude: at(index + 1, 10), retrograde: false }),
    ),
  });

  it("scores across seven divisions", () => {
    const value = saptavargajaBala("Sun", at(5, 10), signsOf(chart));
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(SAPTAVARGAJA_MAX);
  });

  it("caps at moolatrikona in all seven", () => {
    expect(SAPTAVARGAJA_MAX).toBe(7 * 45);
  });

  it("never leaves the range for any longitude", () => {
    const signs = signsOf(chart);
    for (let longitude = 0; longitude < 360; longitude += 3.7) {
      for (const planet of ["Sun", "Moon", "Saturn"] as const) {
        const value = saptavargajaBala(planet, longitude, signs);
        // Seven divisions, each scoring at least the great-enemy weight.
        expect(value).toBeGreaterThanOrEqual(7 * 1.875);
        expect(value).toBeLessThanOrEqual(SAPTAVARGAJA_MAX);
      }
    }
  });

  it("rewards a planet in its own sign more than in an enemy's", () => {
    const signs = signsOf(chart);
    // The Sun in Leo, its own sign, against the Sun in Capricorn.
    expect(saptavargajaBala("Sun", at(5, 10), signs)).toBeGreaterThan(
      saptavargajaBala("Sun", at(10, 10), signs),
    );
  });

  it("is included in the partial sum", () => {
    for (const entry of calculateBala(chart)) {
      expect(entry.saptavargaja).toBeGreaterThan(0);
      expect(entry.partialTotal).toBeGreaterThan(entry.saptavargaja);
    }
  });
});

describe("drik bala", () => {
  const chartOf = (positions: Record<string, number>) =>
    createRashiChart({
      ascendant: { sign: "Aries", degree: 0 },
      planets: Object.entries(positions).map(([planet, longitude]) => ({
        planet: planet as never,
        longitude,
        retrograde: false,
      })),
    });

  const FULL = {
    Sun: at(1), Moon: at(4), Mars: at(6), Mercury: at(8),
    Jupiter: at(9), Venus: at(11), Saturn: at(12),
  };

  it("is positive when a benefic looks at a planet", () => {
    // Jupiter in Aries aspects the 7th, Libra. Put the Moon there, and keep
    // malefics off it.
    const chart = chartOf({
      Sun: at(2), Moon: at(7), Mars: at(3), Mercury: at(5),
      Jupiter: at(1), Venus: at(6), Saturn: at(9),
    });
    const moon = calculateBala(chart).find((entry) => entry.planet === "Moon")!;
    expect(moon.drik).toBeGreaterThan(0);
  });

  it("can be negative, and is not clamped", () => {
    // Saturn in Aries casts a full 3rd aspect onto Gemini.
    const chart = chartOf({
      Sun: at(5), Moon: at(11), Mars: at(6), Mercury: at(3),
      Jupiter: at(8), Venus: at(12), Saturn: at(1),
    });
    const mercury = calculateBala(chart).find((entry) => entry.planet === "Mercury")!;
    expect(mercury.drik).toBeLessThan(0);
  });

  it("divides the net virupas by four", () => {
    const chart = chartOf(FULL);
    for (const entry of calculateBala(chart)) {
      // Nothing can exceed six full aspects either way.
      expect(Math.abs(entry.drik)).toBeLessThanOrEqual((6 * 60) / 4);
    }
  });

  it("is part of the partial sum", () => {
    const chart = chartOf(FULL);
    for (const entry of calculateBala(chart)) {
      expect(entry).toHaveProperty("drik");
    }
  });
});
