import type { PlanetName } from "@/config/astrology";
import { normalizeSign } from "@/lib/astrology/charts/signs";
import { dignityOf } from "@/lib/astrology/charts/dignity";
import { aspectsSign } from "@/lib/astrology/charts/aspects";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * A rule engine for yoga detection.
 *
 * Yogas are declared as rules with a condition, not written into a component.
 * Every rule here has a test, and a yoga is only ever reported when its own
 * condition holds - there is no "likely" and no partial credit.
 *
 * The engine deliberately carries **few** yogas. Classical texts name hundreds,
 * many with conflicting definitions, and a long list of loosely-implemented ones
 * would be worth less than a short list that is right. New rules are added with
 * their tests or not at all.
 *
 * Each result carries the evidence that produced it, so a reading can say why a
 * yoga was reported rather than asking anyone to take it on trust.
 */

export type YogaEvidence = string;

export type YogaResult = {
  name: string;
  /** What the rule looks for, in plain words. */
  definition: string;
  present: boolean;
  /** Why the rule fired. Empty when it did not. */
  evidence: YogaEvidence[];
};

type Context = {
  chart: VedicChartData;
  /** Sign a planet occupies, or undefined if absent from the chart. */
  signOf: (planet: PlanetName) => number | undefined;
  /** House a planet occupies, counted from the ascendant. */
  houseOf: (planet: PlanetName) => number | undefined;
  /** Dignity of a planet where it sits. */
  dignity: (planet: PlanetName) => ReturnType<typeof dignityOf>;
};

type YogaRule = {
  name: string;
  definition: string;
  evaluate: (context: Context) => YogaEvidence[] | null;
};

/** Houses counted from one sign to another, inclusive. */
const houseBetween = (from: number, to: number) => ((to - from + 12) % 12) + 1;

const RULES: YogaRule[] = [
  {
    name: "Gajakesari",
    definition: "Jupiter in an angle from the Moon — the 1st, 4th, 7th or 10th.",
    evaluate: ({ signOf }) => {
      const moon = signOf("Moon");
      const jupiter = signOf("Jupiter");
      if (!moon || !jupiter) return null;

      const house = houseBetween(moon, jupiter);
      return [1, 4, 7, 10].includes(house)
        ? [`jupiter.houseFromMoon=${house}`, `moon.sign=${moon}`, `jupiter.sign=${jupiter}`]
        : null;
    },
  },
  {
    name: "Budha-Aditya",
    definition: "Mercury and the Sun in the same sign.",
    evaluate: ({ signOf }) => {
      const sun = signOf("Sun");
      const mercury = signOf("Mercury");
      if (!sun || !mercury) return null;

      return sun === mercury ? [`sun.sign=${sun}`, `mercury.sign=${mercury}`] : null;
    },
  },
  {
    name: "Chandra-Mangala",
    definition: "The Moon and Mars in the same sign.",
    evaluate: ({ signOf }) => {
      const moon = signOf("Moon");
      const mars = signOf("Mars");
      if (!moon || !mars) return null;

      return moon === mars ? [`moon.sign=${moon}`, `mars.sign=${mars}`] : null;
    },
  },
  {
    name: "Kemadruma",
    definition: "No planet in the 2nd or 12th from the Moon, counting neither the Sun nor the nodes.",
    evaluate: ({ chart, signOf }) => {
      const moon = signOf("Moon");
      if (!moon) return null;

      const second = normalizeSign(moon + 1);
      const twelfth = normalizeSign(moon - 1);

      // The Sun and the nodes are excluded by the classical definition, and the
      // Moon cannot keep itself company.
      const companions = chart.planets.filter(
        (planet) =>
          !["Moon", "Sun", "Rahu", "Ketu"].includes(planet.planet) &&
          [second, twelfth].includes(normalizeSign(planet.sign)),
      );

      return companions.length === 0
        ? [`moon.sign=${moon}`, `moon.second=${second}:empty`, `moon.twelfth=${twelfth}:empty`]
        : null;
    },
  },
  {
    name: "Vipareeta Raja",
    definition:
      "A lord of the 6th, 8th or 12th placed in another of those three houses.",
    evaluate: ({ chart, houseOf }) => {
      const ascendant = normalizeSign(chart.ascendantSign);
      const dusthanas = [6, 8, 12];
      const evidence: YogaEvidence[] = [];

      for (const house of dusthanas) {
        const sign = normalizeSign(ascendant + house - 1);
        // Sign lord by traditional rulership, resolved through the chart.
        const lord = LORD_OF_SIGN[sign];
        const placed = houseOf(lord);
        if (placed && dusthanas.includes(placed) && placed !== house) {
          evidence.push(`lordOf${house}=${lord}`, `${lord}.house=${placed}`);
        }
      }

      return evidence.length > 0 ? evidence : null;
    },
  },
  {
    name: "Neecha Bhanga",
    definition:
      "A debilitated planet whose sign lord, or the lord of its exaltation sign, sits in an angle from the ascendant.",
    evaluate: ({ chart, houseOf, dignity }) => {
      const evidence: YogaEvidence[] = [];

      for (const planet of chart.planets) {
        if (dignity(planet.planet) !== "debilitated") continue;

        const lord = LORD_OF_SIGN[normalizeSign(planet.sign)];
        const lordHouse = houseOf(lord);

        if (lordHouse && [1, 4, 7, 10].includes(lordHouse)) {
          evidence.push(
            `${planet.planet}.dignity=debilitated`,
            `dispositor=${lord}`,
            `${lord}.house=${lordHouse}`,
          );
        }
      }

      return evidence.length > 0 ? evidence : null;
    },
  },
  {
    name: "Kendra Trikona Raja",
    definition:
      "The lord of an angle and the lord of a trine in the same sign, or aspecting one another.",
    evaluate: ({ chart, signOf }) => {
      const ascendant = normalizeSign(chart.ascendantSign);
      const kendraLords = [1, 4, 7, 10].map((house) => LORD_OF_SIGN[normalizeSign(ascendant + house - 1)]);
      const trikonaLords = [5, 9].map((house) => LORD_OF_SIGN[normalizeSign(ascendant + house - 1)]);

      const evidence: YogaEvidence[] = [];

      for (const kendra of kendraLords) {
        for (const trikona of trikonaLords) {
          if (kendra === trikona) continue;

          const a = signOf(kendra);
          const b = signOf(trikona);
          if (!a || !b) continue;

          if (a === b) {
            evidence.push(`${kendra}+${trikona}.conjunct=${a}`);
          } else if (aspectsSign(kendra, a, b) && aspectsSign(trikona, b, a)) {
            evidence.push(`${kendra}<->${trikona}.mutualAspect`);
          }
        }
      }

      return evidence.length > 0 ? [...new Set(evidence)] : null;
    },
  },
];


/**
 * The five Mahapurusha yogas.
 *
 * Each belongs to one planet and holds on the same condition: that planet in
 * its own sign or its exaltation sign, **and** in an angle from the ascendant.
 * The luminaries take no Mahapurusha yoga, which is why only five of the seven
 * appear.
 */
const MAHAPURUSHA: Array<{ name: string; planet: PlanetName }> = [
  { name: "Ruchaka", planet: "Mars" },
  { name: "Bhadra", planet: "Mercury" },
  { name: "Hamsa", planet: "Jupiter" },
  { name: "Malavya", planet: "Venus" },
  { name: "Sasa", planet: "Saturn" },
];

for (const { name, planet } of MAHAPURUSHA) {
  RULES.push({
    name: `${name} (Mahapurusha)`,
    definition: `${planet} in its own or exaltation sign, and in an angle from the ascendant.`,
    evaluate: ({ houseOf, dignity }) => {
      const house = houseOf(planet);
      const standing = dignity(planet);
      if (!house || !standing) return null;

      const dignified = standing === "own sign" || standing === "moolatrikona" || standing === "exalted";
      return dignified && [1, 4, 7, 10].includes(house)
        ? [`${planet}.dignity=${standing}`, `${planet}.house=${house}`]
        : null;
    },
  });
}

/**
 * The three Moon yogas that turn on its neighbours, and their absence.
 *
 * Sunapha, Anapha and Durudhara describe the 2nd and 12th from the Moon being
 * occupied; Kemadruma is the case where neither is. The four are exhaustive and
 * mutually exclusive by construction, which a test relies on: exactly one of
 * them holds in any chart.
 *
 * The Sun and the nodes are excluded from "occupied" throughout, which is the
 * classical definition and the same exclusion Kemadruma already uses.
 */
const MOON_NEIGHBOURS: Array<{ name: string; definition: string; wantsSecond: boolean; wantsTwelfth: boolean }> = [
  {
    name: "Sunapha",
    definition: "A planet in the 2nd from the Moon but none in the 12th, excluding the Sun and nodes.",
    wantsSecond: true,
    wantsTwelfth: false,
  },
  {
    name: "Anapha",
    definition: "A planet in the 12th from the Moon but none in the 2nd, excluding the Sun and nodes.",
    wantsSecond: false,
    wantsTwelfth: true,
  },
  {
    name: "Durudhara",
    definition: "Planets in both the 2nd and the 12th from the Moon, excluding the Sun and nodes.",
    wantsSecond: true,
    wantsTwelfth: true,
  },
];

for (const { name, definition, wantsSecond, wantsTwelfth } of MOON_NEIGHBOURS) {
  RULES.push({
    name,
    definition,
    evaluate: ({ chart, signOf }) => {
      const moon = signOf("Moon");
      if (!moon) return null;

      const occupies = (sign: number) =>
        chart.planets.some(
          (planet) =>
            !["Moon", "Sun", "Rahu", "Ketu"].includes(planet.planet) &&
            normalizeSign(planet.sign) === sign,
        );

      const second = occupies(normalizeSign(moon + 1));
      const twelfth = occupies(normalizeSign(moon - 1));

      return second === wantsSecond && twelfth === wantsTwelfth
        ? [`moon.sign=${moon}`, `moon.second=${second ? "occupied" : "empty"}`, `moon.twelfth=${twelfth ? "occupied" : "empty"}`]
        : null;
    },
  });
}

/** Traditional rulership, indexed by sign number. */
const LORD_OF_SIGN: Record<number, PlanetName> = {
  1: "Mars",
  2: "Venus",
  3: "Mercury",
  4: "Moon",
  5: "Sun",
  6: "Mercury",
  7: "Venus",
  8: "Mars",
  9: "Jupiter",
  10: "Saturn",
  11: "Saturn",
  12: "Jupiter",
};

/** Every rule, evaluated against one chart. */
export function detectYogas(chart: VedicChartData): YogaResult[] {
  const ascendant = normalizeSign(chart.ascendantSign);

  const find = (planet: PlanetName) => chart.planets.find((entry) => entry.planet === planet);

  const context: Context = {
    chart,
    signOf: (planet) => {
      const found = find(planet);
      return found ? normalizeSign(found.sign) : undefined;
    },
    houseOf: (planet) => {
      const found = find(planet);
      return found ? houseBetween(ascendant, normalizeSign(found.sign)) : undefined;
    },
    dignity: (planet) => {
      const found = find(planet);
      return found ? dignityOf(planet, found.longitude) : null;
    },
  };

  return RULES.map((rule) => {
    const evidence = rule.evaluate(context);
    return {
      name: rule.name,
      definition: rule.definition,
      present: evidence !== null,
      evidence: evidence ?? [],
    };
  });
}

/** Only the yogas that actually hold. */
export function presentYogas(chart: VedicChartData): YogaResult[] {
  return detectYogas(chart).filter((yoga) => yoga.present);
}
