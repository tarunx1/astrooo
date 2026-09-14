import { describe, expect, it } from "vitest";
import {
  FULL_DRISHTI,
  aspectHousesFor,
  aspectsSign,
  calculateAspects,
  drishtiStrength,
} from "@/lib/astrology/charts/aspects";
import { createRashiChart } from "@/lib/astrology/charts/factory";

const at = (sign: number, degree = 10) => (sign - 1) * 30 + degree;

describe("graha drishti", () => {
  it("gives every planet the seventh", () => {
    for (const planet of ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const) {
      expect(aspectHousesFor(planet)).toContain(7);
    }
  });

  it("gives Mars the 4th and 8th as well", () => {
    expect(aspectHousesFor("Mars")).toEqual([4, 7, 8]);
  });

  it("gives Jupiter the 5th and 9th as well", () => {
    expect(aspectHousesFor("Jupiter")).toEqual([5, 7, 9]);
  });

  it("gives Saturn the 3rd and 10th as well", () => {
    expect(aspectHousesFor("Saturn")).toEqual([3, 7, 10]);
  });

  it("gives the gentle planets the seventh only", () => {
    for (const planet of ["Sun", "Moon", "Mercury", "Venus"] as const) {
      expect(aspectHousesFor(planet)).toEqual([7]);
    }
  });

  it("gives the nodes none", () => {
    expect(aspectHousesFor("Rahu")).toEqual([]);
    expect(aspectHousesFor("Ketu")).toEqual([]);
    expect(aspectsSign("Rahu", 1, 7)).toBe(false);
  });

  it("lands the seventh on the opposite sign", () => {
    expect(aspectsSign("Sun", 1, 7)).toBe(true);
    expect(aspectsSign("Sun", 1, 6)).toBe(false);
  });

  it("wraps around the zodiac", () => {
    // The 7th from Scorpio is Taurus.
    expect(aspectsSign("Sun", 8, 2)).toBe(true);
    // Saturn's 3rd from Pisces is Taurus.
    expect(aspectsSign("Saturn", 12, 2)).toBe(true);
  });

  it("never has a planet aspect its own sign", () => {
    for (let sign = 1; sign <= 12; sign += 1) {
      for (const planet of ["Sun", "Mars", "Jupiter", "Saturn"] as const) {
        expect(aspectsSign(planet, sign, sign)).toBe(false);
      }
    }
  });
});

describe("aspects in a chart", () => {
  // Sun in Aries, Saturn in Libra (opposite), Jupiter in Gemini.
  const chart = createRashiChart({
    ascendant: { sign: "Aries", degree: 10 },
    planets: [
      { planet: "Sun", longitude: at(1), retrograde: false },
      { planet: "Saturn", longitude: at(7), retrograde: false },
      { planet: "Jupiter", longitude: at(3), retrograde: false },
      { planet: "Rahu", longitude: at(4), retrograde: true },
    ],
  });

  const { planets, houses } = calculateAspects(chart);

  it("finds the mutual opposition between the Sun and Saturn", () => {
    expect(planets).toContainEqual({ from: "Sun", to: "Saturn", house: 7 });
    expect(planets).toContainEqual({ from: "Saturn", to: "Sun", house: 7 });
  });

  it("finds Jupiter's ninth onto Aries", () => {
    // Jupiter in Gemini: the 9th from Gemini is Aquarius, the 5th is Libra,
    // the 7th is Sagittarius. So Jupiter aspects Saturn in Libra by its 5th.
    expect(planets).toContainEqual({ from: "Jupiter", to: "Saturn", house: 5 });
  });

  it("has the nodes casting nothing", () => {
    expect(planets.some((aspect) => aspect.from === "Rahu")).toBe(false);
    expect(houses.some((aspect) => aspect.from === "Rahu")).toBe(false);
  });

  it("can still have a node be aspected", () => {
    // Rahu is in Cancer, and Saturn in Libra aspects the 10th from itself -
    // Cancer. A node casts nothing but can certainly be looked at.
    expect(planets).toContainEqual({ from: "Saturn", to: "Rahu", house: 10 });
  });

  it("counts aspected houses from the ascendant", () => {
    // Aries rising, so Libra is the 7th house. The Sun in Aries aspects it.
    expect(houses).toContainEqual({ from: "Sun", house: 7, aspectHouse: 7 });
  });

  it("gives Saturn three aspected houses and the Sun one", () => {
    expect(houses.filter((aspect) => aspect.from === "Saturn")).toHaveLength(3);
    expect(houses.filter((aspect) => aspect.from === "Sun")).toHaveLength(1);
  });

  it("never reports a planet aspecting itself", () => {
    expect(planets.some((aspect) => aspect.from === aspect.to)).toBe(false);
  });
});

describe("graded drishti", () => {
  it("grades an ordinary planet by house distance", () => {
    // The Sun in Aries: quarter on the 3rd and 10th, half on the 5th and 9th,
    // three quarters on the 4th and 8th, full on the 7th.
    expect(drishtiStrength("Sun", 1, 3)).toBe(15);
    expect(drishtiStrength("Sun", 1, 5)).toBe(30);
    expect(drishtiStrength("Sun", 1, 4)).toBe(45);
    expect(drishtiStrength("Sun", 1, 7)).toBe(FULL_DRISHTI);
  });

  it("gives nothing where there is no aspect at all", () => {
    expect(drishtiStrength("Sun", 1, 2)).toBe(0);
    expect(drishtiStrength("Sun", 1, 6)).toBe(0);
  });

  it("makes the special aspects full where they would be partial", () => {
    // Mars' 4th and 8th are three-quarter aspects for anyone else.
    expect(drishtiStrength("Mars", 1, 4)).toBe(FULL_DRISHTI);
    expect(drishtiStrength("Mars", 1, 8)).toBe(FULL_DRISHTI);
    // Jupiter's 5th and 9th would be half.
    expect(drishtiStrength("Jupiter", 1, 5)).toBe(FULL_DRISHTI);
    // Saturn's 3rd and 10th would be a quarter.
    expect(drishtiStrength("Saturn", 1, 3)).toBe(FULL_DRISHTI);
    expect(drishtiStrength("Saturn", 1, 10)).toBe(FULL_DRISHTI);
  });

  it("agrees with the boolean aspect table on what is aspected at all", () => {
    for (let from = 1; from <= 12; from += 1) {
      for (let to = 1; to <= 12; to += 1) {
        for (const planet of ["Sun", "Mars", "Jupiter", "Saturn"] as const) {
          // A full aspect must always register in the boolean table too.
          if (drishtiStrength(planet, from, to) === FULL_DRISHTI) {
            expect(aspectsSign(planet, from, to)).toBe(true);
          }
        }
      }
    }
  });

  it("gives the nodes nothing", () => {
    expect(drishtiStrength("Rahu", 1, 7)).toBe(0);
    expect(drishtiStrength("Ketu", 1, 7)).toBe(0);
  });
});
