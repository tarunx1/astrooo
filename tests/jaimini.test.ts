import { describe, expect, it } from "vitest";
import {
  CHARA_KARAKAS,
  arudhaOf,
  calculateArudhaPadas,
  calculateCharaKarakas,
  calculateKarakamsa,
} from "@/lib/astrology/charts/jaimini";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { ChartDataError } from "@/lib/astrology/charts/types";

const at = (sign: number, degree: number) => (sign - 1) * 30 + degree;

/** A chart with each planet's degree chosen to make the ranking obvious. */
const chart = createRashiChart({
  ascendant: { sign: "Aries", degree: 5 },
  planets: [
    { planet: "Sun", longitude: at(1, 28), retrograde: false }, // highest
    { planet: "Moon", longitude: at(2, 24), retrograde: false },
    { planet: "Mars", longitude: at(3, 20), retrograde: false },
    { planet: "Mercury", longitude: at(4, 16), retrograde: false },
    { planet: "Jupiter", longitude: at(5, 12), retrograde: false },
    { planet: "Venus", longitude: at(6, 8), retrograde: false },
    { planet: "Saturn", longitude: at(7, 4), retrograde: false },
    { planet: "Rahu", longitude: at(8, 29), retrograde: true }, // reverses to 1
    { planet: "Ketu", longitude: at(2, 29), retrograde: true },
  ],
});

describe("chara karakas", () => {
  const karakas = calculateCharaKarakas(chart);

  it("assigns all eight in order", () => {
    expect(karakas.map((entry) => entry.karaka)).toEqual([...CHARA_KARAKAS]);
  });

  it("makes the planet furthest through its sign the Atmakaraka", () => {
    expect(karakas[0].planet).toBe("Sun");
    expect(karakas[0].karaka).toBe("Atmakaraka");
  });

  it("counts Rahu in reverse", () => {
    const rahu = karakas.find((entry) => entry.planet === "Rahu")!;
    expect(rahu.degreeInSign).toBeCloseTo(29, 9);
    // 30 - 29 = 1, which is the lowest here, so Rahu is last.
    expect(rahu.rankingDegree).toBeCloseTo(1, 9);
    expect(rahu.karaka).toBe("Darakaraka");
  });

  it("excludes Ketu entirely", () => {
    expect(karakas.some((entry) => entry.planet === "Ketu")).toBe(false);
    expect(karakas).toHaveLength(8);
  });

  it("ranks strictly by descending degree", () => {
    for (let index = 1; index < karakas.length; index += 1) {
      expect(karakas[index - 1].rankingDegree).toBeGreaterThanOrEqual(karakas[index].rankingDegree);
    }
  });

  it("would make a low-degree Rahu the Atmakaraka", () => {
    const rahuEarly = createRashiChart({
      ascendant: { sign: "Aries", degree: 5 },
      planets: chart.planets.map((planet) =>
        planet.planet === "Rahu"
          ? { planet: "Rahu" as const, longitude: at(8, 0.5), retrograde: true }
          : { planet: planet.planet, longitude: planet.longitude, retrograde: planet.retrograde },
      ),
    });

    // 30 - 0.5 = 29.5, higher than the Sun's 28.
    expect(calculateCharaKarakas(rahuEarly)[0].planet).toBe("Rahu");
  });

  it("refuses to rank without a planet it needs", () => {
    const partial = createRashiChart({
      ascendant: { sign: "Aries", degree: 5 },
      planets: [{ planet: "Sun", longitude: 10, retrograde: false }],
    });
    expect(() => calculateCharaKarakas(partial)).toThrow(ChartDataError);
  });
});

describe("arudha padas", () => {
  it("counts to the lord and the same distance again", () => {
    // House in Aries, lord in Leo: Leo is the 5th, so count 5 from Leo -> Sagittarius.
    expect(arudhaOf(1, 5)).toEqual({ sign: 9, adjusted: false });
  });

  it("moves a pada off the house itself to the tenth", () => {
    // Lord in its own sign: distance 1, so the pada lands back on the house.
    // It cannot rest there, so it moves to the 10th from it.
    const result = arudhaOf(1, 1);
    expect(result.adjusted).toBe(true);
    expect(result.sign).toBe(10);
  });

  it("moves a pada off the seventh to the tenth", () => {
    // House Aries, lord in Libra: distance 7, count 7 from Libra -> Aries...
    // which is the house itself. Use a case landing on the 7th instead:
    // house Aries, lord in Cancer (4th) -> count 4 from Cancer -> Libra, the 7th.
    const result = arudhaOf(1, 4);
    expect(result.adjusted).toBe(true);
    expect(result.sign).toBe(normalizeTenth(7));
  });

  it("never leaves a pada in the first or seventh from its house", () => {
    for (let houseSign = 1; houseSign <= 12; houseSign += 1) {
      for (let lordSign = 1; lordSign <= 12; lordSign += 1) {
        const { sign } = arudhaOf(houseSign, lordSign);
        expect(sign).not.toBe(houseSign);
        expect(sign).not.toBe(((houseSign + 5) % 12) + 1);
      }
    }
  });

  it("produces a pada for all twelve houses", () => {
    const padas = calculateArudhaPadas(chart);
    expect(padas).toHaveLength(12);
    expect(padas.map((pada) => pada.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (const pada of padas) {
      expect(pada.sign).toBeGreaterThanOrEqual(1);
      expect(pada.sign).toBeLessThanOrEqual(12);
    }
  });

  it("uses the traditional lord of each house sign", () => {
    const padas = calculateArudhaPadas(chart);
    // Aries rising, so the 1st house is Aries and its lord is Mars.
    expect(padas[0].houseSign).toBe(1);
    expect(padas[0].lord).toBe("Mars");
    // The 12th house is Pisces, ruled by Jupiter.
    expect(padas[11].houseSign).toBe(12);
    expect(padas[11].lord).toBe("Jupiter");
  });
});

/** The tenth sign from a given one, 1-based. */
function normalizeTenth(sign: number): number {
  return ((sign - 1 + 9) % 12) + 1;
}

describe("karakamsa", () => {
  it("is the Atmakaraka's navamsa sign", () => {
    const result = calculateKarakamsa(chart);
    expect(result.atmakaraka).toBe("Sun");
    // The Sun is at 28 Aries; Aries is movable so its navamsa counts from
    // Aries, and 28 falls in the ninth navamsa - Sagittarius.
    expect(result.sign).toBe(9);
  });

  it("follows the Atmakaraka when the ranking changes", () => {
    const rahuFirst = createRashiChart({
      ascendant: { sign: "Aries", degree: 5 },
      planets: chart.planets.map((planet) =>
        planet.planet === "Rahu"
          ? { planet: "Rahu" as const, longitude: at(8, 0.5), retrograde: true }
          : { planet: planet.planet, longitude: planet.longitude, retrograde: planet.retrograde },
      ),
    });
    expect(calculateKarakamsa(rahuFirst).atmakaraka).toBe("Rahu");
  });
});
