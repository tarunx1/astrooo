import type { PlanetName } from "@/config/astrology";
import { normalizeLongitude, normalizeSign } from "@/lib/astrology/charts/signs";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Natural benefic and malefic, including the two that depend on the chart.
 *
 * Five planets are fixed: Jupiter and Venus are benefic, the Sun, Mars and
 * Saturn malefic, and the nodes malefic. Two are **conditional**, and that is
 * the whole reason this is a calculation rather than a lookup:
 *
 *   the Moon    - benefic while waxing, malefic while waning
 *   Mercury     - benefic alone or with benefics, malefic in malefic company
 *
 * Both conditions are computable from positions already known, so neither is
 * guessed. The waxing test is the Moon's elongation from the Sun: nought to a
 * hundred and eighty degrees ahead is the bright fortnight.
 *
 * **A variant not taken:** some authorities weaken the Moon further when it is
 * close to the Sun regardless of fortnight - within 72 degrees, on one common
 * reckoning - and would call such a Moon malefic even while waxing. That
 * refinement is not applied; the plain paksha rule is, and the elongation is
 * reported so a reader can apply their own threshold.
 */

export type Benefic = "benefic" | "malefic";

const FIXED: Partial<Record<PlanetName, Benefic>> = {
  Jupiter: "benefic",
  Venus: "benefic",
  Sun: "malefic",
  Mars: "malefic",
  Saturn: "malefic",
  Rahu: "malefic",
  Ketu: "malefic",
};

export type BeneficNature = {
  planet: PlanetName;
  nature: Benefic;
  /** True when the verdict came from the chart rather than the fixed table. */
  conditional: boolean;
  /** Why, for the two that depend on circumstance. */
  reason?: string;
};

/**
 * The Moon's elongation from the Sun, 0 to 360 degrees.
 *
 * Under 180 is the waxing fortnight. Exported because the threshold above which
 * a waxing Moon is considered strong differs by authority, and a caller with a
 * different rule needs the number rather than this module's verdict.
 */
export function moonElongation(chart: VedicChartData): number | null {
  const sun = chart.planets.find((planet) => planet.planet === "Sun");
  const moon = chart.planets.find((planet) => planet.planet === "Moon");
  if (!sun || !moon) return null;

  return normalizeLongitude(moon.longitude - sun.longitude);
}

/** Every planet in the chart, classified. */
export function calculateBeneficNatures(chart: VedicChartData): BeneficNature[] {
  const elongation = moonElongation(chart);

  const malefics = new Set(
    chart.planets
      .filter((planet) => FIXED[planet.planet] === "malefic")
      .map((planet) => planet.planet),
  );

  return chart.planets.map((planet) => {
    const fixed = FIXED[planet.planet];
    if (fixed) return { planet: planet.planet, nature: fixed, conditional: false };

    if (planet.planet === "Moon") {
      // Waxing is the bright fortnight: the Moon ahead of the Sun by up to 180.
      const waxing = elongation !== null && elongation < 180;
      return {
        planet: planet.planet,
        nature: waxing ? "benefic" : "malefic",
        conditional: true,
        reason:
          elongation === null
            ? "The Sun's position is unknown, so the fortnight cannot be determined."
            : `${waxing ? "Waxing" : "Waning"} — ${elongation.toFixed(1)}° from the Sun.`,
      };
    }

    if (planet.planet === "Mercury") {
      // Company is judged by shared sign, which is the usual reading.
      const companions = chart.planets.filter(
        (other) =>
          other.planet !== "Mercury" &&
          normalizeSign(other.sign) === normalizeSign(planet.sign) &&
          malefics.has(other.planet),
      );

      return {
        planet: planet.planet,
        nature: companions.length > 0 ? "malefic" : "benefic",
        conditional: true,
        reason:
          companions.length > 0
            ? `In the company of ${companions.map((entry) => entry.planet).join(", ")}.`
            : "Alone, or with benefics only.",
      };
    }

    // Anything outside the classical seven and the nodes is not classified.
    return { planet: planet.planet, nature: "malefic", conditional: false };
  });
}
