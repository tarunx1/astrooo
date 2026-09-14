import { describe, expect, it } from "vitest";
import { detectYogas, presentYogas } from "@/lib/astrology/charts/yogas";
import { createRashiChart } from "@/lib/astrology/charts/factory";

const at = (sign: number, degree = 10) => (sign - 1) * 30 + degree;

const build = (positions: Partial<Record<string, number>>, ascendant = "Aries") =>
  createRashiChart({
    ascendant: { sign: ascendant, degree: 10 },
    planets: Object.entries(positions).map(([planet, longitude]) => ({
      planet: planet as never,
      longitude: longitude!,
      retrograde: false,
    })),
  });

const BASE = {
  Sun: at(1),
  Moon: at(2),
  Mars: at(3),
  Mercury: at(4),
  Jupiter: at(5),
  Venus: at(6),
  Saturn: at(7),
  Rahu: at(8),
  Ketu: at(2),
};

const yoga = (chart: ReturnType<typeof build>, name: string) =>
  detectYogas(chart).find((entry) => entry.name === name)!;

describe("yoga rule engine", () => {
  it("reports every rule, present or not", () => {
    const results = detectYogas(build(BASE));
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.name).toBeTruthy();
      expect(result.definition).toBeTruthy();
      expect(typeof result.present).toBe("boolean");
    }
  });

  it("carries evidence only when a yoga holds", () => {
    for (const result of detectYogas(build(BASE))) {
      if (result.present) expect(result.evidence.length).toBeGreaterThan(0);
      else expect(result.evidence).toEqual([]);
    }
  });

  it("presentYogas returns only those that hold", () => {
    const chart = build(BASE);
    expect(presentYogas(chart).every((entry) => entry.present)).toBe(true);
  });
});

describe("Gajakesari", () => {
  it("holds with Jupiter in an angle from the Moon", () => {
    // Moon in Taurus (2), Jupiter in Leo (5): the 4th from the Moon.
    expect(yoga(build({ ...BASE, Moon: at(2), Jupiter: at(5) }), "Gajakesari").present).toBe(true);
  });

  it("does not hold when Jupiter is elsewhere", () => {
    // Moon in Taurus, Jupiter in Gemini: the 2nd.
    expect(yoga(build({ ...BASE, Moon: at(2), Jupiter: at(3) }), "Gajakesari").present).toBe(false);
  });

  it("holds when they share a sign, which is the 1st", () => {
    expect(yoga(build({ ...BASE, Moon: at(2), Jupiter: at(2) }), "Gajakesari").present).toBe(true);
  });
});

describe("Budha-Aditya", () => {
  it("holds when Mercury joins the Sun", () => {
    expect(yoga(build({ ...BASE, Sun: at(1), Mercury: at(1, 20) }), "Budha-Aditya").present).toBe(true);
  });

  it("does not hold across a sign boundary", () => {
    expect(yoga(build({ ...BASE, Sun: at(1, 29) , Mercury: at(2, 1) }), "Budha-Aditya").present).toBe(false);
  });
});

describe("Kemadruma", () => {
  it("holds when the Moon has no companion either side", () => {
    // Moon in Taurus(2). Nothing in Aries(1) or Gemini(3) but the Sun, which
    // the definition excludes.
    const chart = build({
      Sun: at(1),
      Moon: at(2),
      Mars: at(7),
      Mercury: at(8),
      Jupiter: at(9),
      Venus: at(10),
      Saturn: at(11),
      Rahu: at(3),
      Ketu: at(9),
    });
    expect(yoga(chart, "Kemadruma").present).toBe(true);
  });

  it("is broken by a planet in the 2nd from the Moon", () => {
    const chart = build({ ...BASE, Moon: at(2), Mars: at(3) });
    expect(yoga(chart, "Kemadruma").present).toBe(false);
  });

  it("is not broken by the nodes alone", () => {
    const chart = build({
      Sun: at(6),
      Moon: at(2),
      Mars: at(7),
      Mercury: at(8),
      Jupiter: at(9),
      Venus: at(10),
      Saturn: at(11),
      Rahu: at(1),
      Ketu: at(3),
    });
    expect(yoga(chart, "Kemadruma").present).toBe(true);
  });
});

describe("Neecha Bhanga", () => {
  it("holds when a debilitated planet's dispositor is in an angle", () => {
    // Jupiter debilitated in Capricorn(10); its lord Saturn in Aries(1),
    // which is the 1st house for an Aries ascendant. Venus is moved out of
    // Virgo, where it would be debilitated too and satisfy the rule on its
    // own account - the assertion below is about Jupiter.
    const chart = build({ ...BASE, Venus: at(2), Jupiter: at(10, 5), Saturn: at(1, 15) });
    const result = yoga(chart, "Neecha Bhanga");
    expect(result.present).toBe(true);
    expect(result.evidence).toContain("Jupiter.dignity=debilitated");
  });

  it("does not hold when the dispositor is not in an angle", () => {
    // Saturn in Gemini(3) - the 3rd house, not an angle. Venus is again kept
    // out of Virgo so Jupiter is the only debilitated planet in the chart.
    const chart = build({ ...BASE, Venus: at(2), Jupiter: at(10, 5), Saturn: at(3, 15) });
    expect(yoga(chart, "Neecha Bhanga").present).toBe(false);
  });
});

describe("Vipareeta Raja", () => {
  it("holds when a dusthana lord sits in another dusthana", () => {
    // Aries rising: 6th is Virgo (Mercury), 8th is Scorpio, 12th is Pisces.
    // Put Mercury in Pisces(12), the 12th house.
    const chart = build({ ...BASE, Mercury: at(12) });
    expect(yoga(chart, "Vipareeta Raja").present).toBe(true);
  });

  it("does not hold when the lord sits in its own dusthana", () => {
    // Mercury in Virgo, which is the 6th itself - not another dusthana.
    const chart = build({ ...BASE, Mercury: at(6) });
    expect(yoga(chart, "Vipareeta Raja").present).toBe(false);
  });
});

describe("Mahapurusha yogas", () => {
  it("holds for a dignified planet in an angle", () => {
    // Saturn in Aquarius(11), its own sign. Aquarius rising makes that the 1st.
    const chart = build({ ...BASE, Saturn: at(11, 25) }, "Aquarius");
    expect(yoga(chart, "Sasa (Mahapurusha)").present).toBe(true);
  });

  it("does not hold when the planet is dignified but not in an angle", () => {
    // Saturn in Aquarius with Aries rising: the 11th house, not an angle.
    const chart = build({ ...BASE, Saturn: at(11, 25) }, "Aries");
    expect(yoga(chart, "Sasa (Mahapurusha)").present).toBe(false);
  });

  it("does not hold when the planet is in an angle but undignified", () => {
    // Mars in Cancer(4) - debilitated - with Aries rising: the 4th, an angle.
    const chart = build({ ...BASE, Mars: at(4, 20) }, "Aries");
    expect(yoga(chart, "Ruchaka (Mahapurusha)").present).toBe(false);
  });

  it("offers one for each of the five non-luminaries", () => {
    const names = detectYogas(build(BASE))
      .filter((entry) => entry.name.includes("Mahapurusha"))
      .map((entry) => entry.name);

    expect(names).toHaveLength(5);
    expect(names.join(" ")).not.toMatch(/Sun|Moon/);
  });
});

describe("the Moon's neighbours", () => {
  const MOON_YOGAS = ["Sunapha", "Anapha", "Durudhara", "Kemadruma"];

  const holding = (chart: ReturnType<typeof build>) =>
    detectYogas(chart)
      .filter((entry) => MOON_YOGAS.includes(entry.name) && entry.present)
      .map((entry) => entry.name);

  it("gives Sunapha when only the 2nd is occupied", () => {
    // Moon in Taurus(2); Mars in Gemini(3), nothing in Aries(1) but the Sun.
    const chart = build({
      Sun: at(1), Moon: at(2), Mars: at(3), Mercury: at(8),
      Jupiter: at(9), Venus: at(10), Saturn: at(11), Rahu: at(1), Ketu: at(7),
    });
    expect(holding(chart)).toEqual(["Sunapha"]);
  });

  it("gives Anapha when only the 12th is occupied", () => {
    const chart = build({
      Sun: at(6), Moon: at(2), Mars: at(1), Mercury: at(8),
      Jupiter: at(9), Venus: at(10), Saturn: at(11), Rahu: at(3), Ketu: at(9),
    });
    expect(holding(chart)).toEqual(["Anapha"]);
  });

  it("gives Durudhara when both are occupied", () => {
    const chart = build({
      Sun: at(6), Moon: at(2), Mars: at(1), Mercury: at(3),
      Jupiter: at(9), Venus: at(10), Saturn: at(11), Rahu: at(7), Ketu: at(1),
    });
    expect(holding(chart)).toEqual(["Durudhara"]);
  });

  /**
   * The four are exhaustive and mutually exclusive by construction: the 2nd and
   * 12th are each either occupied or not, which is four cases and no more. If
   * two ever hold together, or none does, a rule has drifted.
   */
  it("has exactly one of the four holding in any chart", () => {
    for (let shift = 0; shift < 12; shift += 1) {
      const shifted = Object.fromEntries(
        Object.entries(BASE).map(([planet, longitude]) => [planet, (longitude + shift * 30) % 360]),
      );
      expect(holding(build(shifted))).toHaveLength(1);
    }
  });
});
