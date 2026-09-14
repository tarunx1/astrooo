import { describe, expect, it } from "vitest";
import {
  RELATIONSHIP_PLANETS,
  calculateRelationships,
  compoundRelation,
  naturalRelation,
  temporalRelation,
} from "@/lib/astrology/charts/relationships";
import {
  calculateConditions,
  debilitationOf,
  dignityOf,
  isCombust,
  isDeeply,
} from "@/lib/astrology/charts/dignity";
import { createRashiChart } from "@/lib/astrology/charts/factory";
import { ChartDataError } from "@/lib/astrology/charts/types";

const at = (sign: number, degree: number) => (sign - 1) * 30 + degree;

describe("natural friendship", () => {
  it("matches the classical table for the Sun", () => {
    expect(naturalRelation("Sun", "Moon")).toBe("friend");
    expect(naturalRelation("Sun", "Mars")).toBe("friend");
    expect(naturalRelation("Sun", "Jupiter")).toBe("friend");
    expect(naturalRelation("Sun", "Mercury")).toBe("neutral");
    expect(naturalRelation("Sun", "Venus")).toBe("enemy");
    expect(naturalRelation("Sun", "Saturn")).toBe("enemy");
  });

  it("gives the Moon no natural enemies", () => {
    for (const planet of RELATIONSHIP_PLANETS) {
      expect(naturalRelation("Moon", planet)).not.toBe("enemy");
    }
  });

  it("is not symmetric", () => {
    // Mercury counts the Moon an enemy; the Moon counts Mercury a friend.
    expect(naturalRelation("Mercury", "Moon")).toBe("enemy");
    expect(naturalRelation("Moon", "Mercury")).toBe("friend");
  });

  it("covers every pair with one of the three values", () => {
    for (const from of RELATIONSHIP_PLANETS) {
      for (const to of RELATIONSHIP_PLANETS) {
        expect(["friend", "neutral", "enemy"]).toContain(naturalRelation(from, to));
      }
    }
  });
});

describe("temporal friendship", () => {
  it("counts the 2nd, 3rd, 4th, 10th, 11th and 12th as friendly", () => {
    for (const house of [2, 3, 4, 10, 11, 12]) {
      expect(temporalRelation(1, house)).toBe("friend");
    }
  });

  it("counts the 1st, 5th, 6th, 7th, 8th and 9th as unfriendly", () => {
    for (const house of [1, 5, 6, 7, 8, 9]) {
      expect(temporalRelation(1, house)).toBe("enemy");
    }
  });

  it("is exhaustive - there is no temporal neutral", () => {
    for (let from = 1; from <= 12; from += 1) {
      for (let to = 1; to <= 12; to += 1) {
        expect(["friend", "enemy"]).toContain(temporalRelation(from, to));
      }
    }
  });

  it("wraps around the zodiac", () => {
    // The 2nd from Pisces is Aries.
    expect(temporalRelation(12, 1)).toBe("friend");
  });
});

describe("compound friendship", () => {
  it("follows the five-fold scale", () => {
    expect(compoundRelation("friend", "friend")).toBe("great friend");
    expect(compoundRelation("friend", "enemy")).toBe("neutral");
    expect(compoundRelation("neutral", "friend")).toBe("friend");
    expect(compoundRelation("neutral", "enemy")).toBe("enemy");
    expect(compoundRelation("enemy", "friend")).toBe("neutral");
    expect(compoundRelation("enemy", "enemy")).toBe("great enemy");
  });

  it("lets a temporally friendly place lift a natural enemy to neutral", () => {
    expect(compoundRelation("enemy", "friend")).not.toBe("enemy");
  });
});

describe("relationship matrix", () => {
  const chart = createRashiChart({
    ascendant: { sign: "Aries", degree: 10 },
    planets: [
      { planet: "Sun", longitude: at(1, 10), retrograde: false },
      { planet: "Moon", longitude: at(2, 10), retrograde: false },
      { planet: "Mars", longitude: at(3, 10), retrograde: false },
      { planet: "Mercury", longitude: at(4, 10), retrograde: false },
      { planet: "Jupiter", longitude: at(5, 10), retrograde: false },
      { planet: "Venus", longitude: at(6, 10), retrograde: false },
      { planet: "Saturn", longitude: at(7, 10), retrograde: false },
    ],
  });

  it("has a cell for every ordered pair but not for a planet with itself", () => {
    const cells = calculateRelationships(chart);
    expect(cells).toHaveLength(RELATIONSHIP_PLANETS.length * (RELATIONSHIP_PLANETS.length - 1));
    expect(cells.some((cell) => cell.from === cell.to)).toBe(false);
  });

  it("agrees with the three functions it is built from", () => {
    for (const cell of calculateRelationships(chart)) {
      expect(cell.natural).toBe(naturalRelation(cell.from, cell.to));
      expect(cell.compound).toBe(compoundRelation(cell.natural, cell.temporal));
    }
  });

  it("refuses to build a table without a planet it needs", () => {
    const partial = createRashiChart({
      ascendant: { sign: "Aries", degree: 10 },
      planets: [{ planet: "Sun", longitude: 10, retrograde: false }],
    });
    expect(() => calculateRelationships(partial)).toThrow(ChartDataError);
  });
});

describe("dignity", () => {
  it("places each planet's exaltation at the classical point", () => {
    expect(dignityOf("Sun", at(1, 10))).toBe("exalted"); // Aries
    expect(dignityOf("Moon", at(2, 3))).toBe("exalted"); // Taurus
    expect(dignityOf("Mars", at(10, 28))).toBe("exalted"); // Capricorn
    expect(dignityOf("Mercury", at(6, 15))).toBe("exalted"); // Virgo
    expect(dignityOf("Jupiter", at(4, 5))).toBe("exalted"); // Cancer
    expect(dignityOf("Venus", at(12, 27))).toBe("exalted"); // Pisces
    expect(dignityOf("Saturn", at(7, 20))).toBe("exalted"); // Libra
  });

  it("debilitates in the sign opposite the exaltation", () => {
    expect(dignityOf("Sun", at(7, 10))).toBe("debilitated"); // Libra
    expect(dignityOf("Jupiter", at(10, 5))).toBe("debilitated"); // Capricorn
    expect(debilitationOf("Venus")).toEqual({ sign: 6, degree: 27 }); // Virgo
  });

  it("recognises moolatrikona inside its arc and own sign outside it", () => {
    expect(dignityOf("Sun", at(5, 10))).toBe("moolatrikona"); // Leo 0-20
    expect(dignityOf("Sun", at(5, 25))).toBe("own sign"); // Leo beyond it
  });

  it("falls back to the relationship with the sign's lord", () => {
    // Jupiter in Aries: Mars rules it, and Mars is Jupiter's natural friend.
    expect(dignityOf("Jupiter", at(1, 20))).toBe("friend's sign");
    // Saturn in Leo: the Sun rules it, and the Sun is Saturn's natural enemy.
    expect(dignityOf("Saturn", at(5, 10))).toBe("enemy's sign");
  });

  it("gives the nodes no dignity, since they own no sign", () => {
    expect(dignityOf("Rahu", at(2, 10))).toBeNull();
    expect(dignityOf("Ketu", at(8, 10))).toBeNull();
  });

  it("marks the exact exaltation degree as deep", () => {
    expect(isDeeply("Sun", at(1, 10))).toBe(true);
    expect(isDeeply("Sun", at(1, 25))).toBe(false);
  });
});

describe("combustion", () => {
  it("uses the planet's own orb", () => {
    expect(isCombust("Mars", at(1, 10), at(1, 0))).toBe(true); // 10 within 17
    expect(isCombust("Jupiter", at(1, 12), at(1, 0))).toBe(false); // 12 beyond 11
  });

  it("tightens the orb for a retrograde Mercury or Venus", () => {
    expect(isCombust("Mercury", at(1, 13), at(1, 0), false)).toBe(true); // within 14
    expect(isCombust("Mercury", at(1, 13), at(1, 0), true)).toBe(false); // beyond 12
  });

  it("measures the shorter arc, so either side of the Sun counts", () => {
    expect(isCombust("Venus", at(1, 5), at(1, 0))).toBe(true);
    expect(isCombust("Venus", at(12, 25), at(1, 0))).toBe(true);
  });

  it("never reports the Sun as combust, nor the nodes", () => {
    const chart = createRashiChart({
      ascendant: { sign: "Aries", degree: 10 },
      planets: [
        { planet: "Sun", longitude: at(1, 10), retrograde: false },
        { planet: "Rahu", longitude: at(1, 11), retrograde: true },
      ],
    });

    const conditions = calculateConditions(chart);
    expect(conditions.find((entry) => entry.planet === "Sun")?.combust).toBe(false);
    expect(conditions.find((entry) => entry.planet === "Rahu")?.combust).toBe(false);
  });
});
