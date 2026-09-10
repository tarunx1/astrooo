import { describe, expect, it } from "vitest";
import {
  NumerologyCalculationError,
  calculateBirthNumber,
  calculateLifePath,
  calculateNameNumber,
  calculateNumerology,
  calculatePersonality,
  calculateSoulUrge,
} from "@/lib/numerology/calculator";
import {
  CHALDEAN_LETTER_VALUES,
  chaldeanSum,
  digitSum,
  isMasterNumber,
  normalizeNameForNumerology,
  reduceKeepingMasters,
  reduceToSingleDigit,
  rulerFor,
} from "@/lib/numerology/rules";

/**
 * Numerology is pure arithmetic, so every expectation below is worked out by
 * hand in the comment rather than snapshotted from the implementation.
 */
describe("reduction rules", () => {
  it("reduces to a single digit", () => {
    expect(reduceToSingleDigit(1)).toBe(1);
    expect(reduceToSingleDigit(10)).toBe(1);
    expect(reduceToSingleDigit(39)).toBe(3); // 3+9=12 → 1+2=3
    expect(reduceToSingleDigit(999)).toBe(9); // 27 → 9
  });

  it("preserves master numbers when asked to", () => {
    expect(reduceKeepingMasters(29)).toBe(11); // 2+9 = 11, master
    expect(reduceKeepingMasters(11)).toBe(11);
    expect(reduceKeepingMasters(22)).toBe(22);
    expect(reduceKeepingMasters(33)).toBe(33);
    expect(reduceKeepingMasters(39)).toBe(3); // 12 → 3, no master on the way
  });

  it("reduces master numbers away when tradition requires it", () => {
    expect(reduceToSingleDigit(11)).toBe(2);
    expect(reduceToSingleDigit(22)).toBe(4);
    expect(reduceToSingleDigit(33)).toBe(6);
  });

  it("identifies master numbers", () => {
    expect(isMasterNumber(11)).toBe(true);
    expect(isMasterNumber(22)).toBe(true);
    expect(isMasterNumber(33)).toBe(true);
    expect(isMasterNumber(44)).toBe(false);
    expect(isMasterNumber(9)).toBe(false);
  });

  it("sums digits", () => {
    expect(digitSum(1992)).toBe(21);
    expect(digitSum(0)).toBe(0);
  });
});

describe("Chaldean letter system", () => {
  it("never assigns 9, which is what separates it from Pythagorean", () => {
    expect(Object.values(CHALDEAN_LETTER_VALUES)).not.toContain(9);
    expect(Math.max(...Object.values(CHALDEAN_LETTER_VALUES))).toBe(8);
    expect(Math.min(...Object.values(CHALDEAN_LETTER_VALUES))).toBe(1);
  });

  it("covers all 26 letters", () => {
    for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      expect(CHALDEAN_LETTER_VALUES[letter], letter).toBeGreaterThanOrEqual(1);
    }
    expect(Object.keys(CHALDEAN_LETTER_VALUES)).toHaveLength(26);
  });

  it("sums a known name by hand", () => {
    // R=2 A=1 M=4 → 7
    expect(chaldeanSum("RAM")).toBe(7);
    // S=3 I=1 T=4 A=1 → 9
    expect(chaldeanSum("SITA")).toBe(9);
  });

  it("normalises names to plain letters", () => {
    expect(normalizeNameForNumerology("Tarun Sharma")).toBe("TARUNSHARMA");
    expect(normalizeNameForNumerology("O'Brien-Smith")).toBe("OBRIENSMITH");
    expect(normalizeNameForNumerology("José")).toBe("JOSE");
    expect(normalizeNameForNumerology("R2-D2")).toBe("RD");
    expect(normalizeNameForNumerology("   ")).toBe("");
  });
});

describe("Life Path", () => {
  it("computes a worked example", () => {
    // 14/08/1992: day 14 → 5, month 8 → 8, year 1992 → 21 → 3. 5+8+3 = 16 → 7.
    const result = calculateLifePath("1992-08-14");
    expect(result.value).toBe(7);
    expect(result.isMasterNumber).toBe(false);
    expect(result.ruler).toBe("Ketu");
    expect(result.workings).toContain("16");
  });

  it("preserves a master total", () => {
    // 29/11/1990: day 29 → 11, month 11 → 11, year 1990 → 19 → 10 → 1.
    // 11+11+1 = 23 → 5.
    expect(calculateLifePath("1990-11-29").value).toBe(5);

    // 22/02/2000: day 22 → 22, month 2 → 2, year 2000 → 2. 22+2+2 = 26 → 8.
    expect(calculateLifePath("2000-02-22").value).toBe(8);
  });

  it("yields a master Life Path when the total is one", () => {
    // 09/09/2009: day 9, month 9, year 2009 → 11. 9+9+11 = 29 → 11 (master).
    const result = calculateLifePath("2009-09-09");
    expect(result.value).toBe(11);
    expect(result.isMasterNumber).toBe(true);
  });

  it("is deterministic", () => {
    expect(calculateLifePath("1992-08-14")).toEqual(calculateLifePath("1992-08-14"));
  });

  it("rejects malformed and impossible dates", () => {
    expect(() => calculateLifePath("14-08-1992")).toThrow(NumerologyCalculationError);
    expect(() => calculateLifePath("1992-13-01")).toThrow(NumerologyCalculationError);
    expect(() => calculateLifePath("2026-02-30")).toThrow(NumerologyCalculationError);
    expect(() => calculateLifePath("not-a-date")).toThrow(NumerologyCalculationError);
  });
});

describe("Birth Number", () => {
  it("reduces the day of the month to 1-9", () => {
    expect(calculateBirthNumber("1992-08-14").value).toBe(5); // 1+4
    expect(calculateBirthNumber("1992-08-09").value).toBe(9);
    expect(calculateBirthNumber("1992-08-31").value).toBe(4); // 3+1
  });

  it("does not preserve master numbers, by tradition", () => {
    // The 29th is Mulank 2, not 11.
    const result = calculateBirthNumber("1990-11-29");
    expect(result.value).toBe(2);
    expect(result.isMasterNumber).toBe(false);
  });

  it("assigns the traditional ruler", () => {
    expect(calculateBirthNumber("1992-08-01").ruler).toBe("Sun");
    expect(calculateBirthNumber("1992-08-08").ruler).toBe("Saturn");
    expect(calculateBirthNumber("1992-08-09").ruler).toBe("Mars");
  });
});

describe("name numbers", () => {
  it("computes the name number by hand", () => {
    // RAM = 2+1+4 = 7
    const result = calculateNameNumber("Ram");
    expect(result?.value).toBe(7);
    expect(result?.workings).toContain("= 7");
  });

  it("splits vowels and consonants", () => {
    // SITA: vowels I=1 A=1 → 2; consonants S=3 T=4 → 7
    expect(calculateSoulUrge("Sita")?.value).toBe(2);
    expect(calculatePersonality("Sita")?.value).toBe(7);
  });

  it("returns null when a name has no scoreable letters", () => {
    expect(calculateNameNumber("123")).toBeNull();
    expect(calculateSoulUrge("BCD")).toBeNull();
    expect(calculatePersonality("AEIOU")).toBeNull();
  });

  it("ignores case, spacing and punctuation", () => {
    expect(calculateNameNumber("ram")?.value).toBe(calculateNameNumber("R A M!")?.value);
  });
});

describe("full result", () => {
  it("includes date numbers and reports name numbers as unavailable without a name", () => {
    const result = calculateNumerology({ dateOfBirth: "1992-08-14" });

    expect(result.system).toBe("chaldean");
    expect(result.numbers.map((number) => number.key)).toEqual(["lifePath", "birthNumber"]);
    expect(result.unavailable).toHaveLength(3);
    expect(result.unavailable.every((entry) => entry.reason.includes("Add a name"))).toBe(true);
  });

  it("includes all five numbers when a name is supplied", () => {
    const result = calculateNumerology({ dateOfBirth: "1992-08-14", name: "Tarun Sharma" });

    expect(result.numbers.map((number) => number.key)).toEqual([
      "lifePath",
      "birthNumber",
      "nameNumber",
      "soulUrge",
      "personality",
    ]);
    expect(result.unavailable).toHaveLength(0);
    expect(result.name).toBe("Tarun Sharma");
  });

  it("shows its working for every number", () => {
    const result = calculateNumerology({ dateOfBirth: "1992-08-14", name: "Ram" });
    for (const number of result.numbers) {
      expect(number.workings.length, number.key).toBeGreaterThan(3);
      expect(number.ruler, number.key).toBeTruthy();
    }
  });

  it("is stable across every day of a month", () => {
    for (let day = 1; day <= 31; day += 1) {
      const date = `1992-01-${String(day).padStart(2, "0")}`;
      const result = calculateNumerology({ dateOfBirth: date });
      const lifePath = result.numbers[0].value;
      const birth = result.numbers[1].value;

      expect(birth, date).toBeGreaterThanOrEqual(1);
      expect(birth, date).toBeLessThanOrEqual(9);
      expect(lifePath, date).toBeGreaterThanOrEqual(1);
      expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33], date).toContain(lifePath);
    }
  });
});

describe("rulers", () => {
  it("maps 1-9 to their traditional planets", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(rulerFor)).toEqual([
      "Sun", "Moon", "Jupiter", "Rahu", "Mercury", "Venus", "Ketu", "Saturn", "Mars",
    ]);
  });

  it("attributes a master number to its reduced ruler", () => {
    expect(rulerFor(11)).toBe("Moon"); // reduces to 2
    expect(rulerFor(22)).toBe("Rahu"); // reduces to 4
    expect(rulerFor(33)).toBe("Venus"); // reduces to 6
  });
});
