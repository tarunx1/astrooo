import type { PlanetName } from "@/config/astrology";
import {
  getDegreeInSign,
  getSignNumber,
  normalizeLongitude,
  normalizeSign,
} from "@/lib/astrology/charts/signs";
import { getVargaIndex, getVargaSign } from "@/lib/astrology/charts/varga";
import { drishtiStrength } from "@/lib/astrology/charts/aspects";
import { calculateBeneficNatures, type Benefic } from "@/lib/astrology/charts/benefic";
import { debilitationOf } from "@/lib/astrology/charts/dignity";
import {
  compoundRelation,
  naturalRelation,
  temporalRelation,
  type RelationshipPlanet,
} from "@/lib/astrology/charts/relationships";
import { getSignLord } from "@/lib/astrology/kp/vimshottari";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Bala: the components of planetary strength that have one reading.
 *
 * **This is not Shadbala.** Shadbala is the sum of six balas, and two of them -
 * the full Kala Bala and Chesta Bala - rest on conventions that genuinely
 * differ between authorities: which epoch a year-lord counts from, how true
 * motion is compared against mean, how a planetary war is scored. A total
 * assembled from some defensible parts and some guessed ones is worth less than
 * no total at all, because nothing in the number says which is which.
 *
 * So this module calculates the components whose rules are unambiguous, names
 * each one, and **deliberately does not add them up**. What is here can be
 * checked line by line against a classical text. A `shadbalaTotal` is absent on
 * purpose and should stay absent until every component exists.
 *
 * Units are Shashtiamsas - sixtieths - which is how the tradition scores bala.
 * One rupa is 60 Shashtiamsas.
 */

export const SHASHTIAMSAS_PER_RUPA = 60;

/** The seven that take a bala. The nodes are not scored. */
const BALA_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
] as const;

export type BalaPlanet = (typeof BALA_PLANETS)[number];

/**
 * Naisargika Bala: permanent, natural brightness.
 *
 * A fixed ranking, and the only bala that does not depend on the chart at all.
 * The values are exactly 60k/7 for k = 7 down to 1, which is what makes the
 * table self-checking: a mistyped figure would not be a multiple of 60/7.
 */
const NAISARGIKA_RANK: Record<BalaPlanet, number> = {
  Sun: 7,
  Moon: 6,
  Venus: 5,
  Jupiter: 4,
  Mercury: 3,
  Mars: 2,
  Saturn: 1,
};

export function naisargikaBala(planet: BalaPlanet): number {
  return (SHASHTIAMSAS_PER_RUPA * NAISARGIKA_RANK[planet]) / 7;
}

/**
 * Uchcha Bala: strength from the exaltation point.
 *
 * Sixty at exact exaltation, nothing at exact debilitation, and linear between
 * them. The measure is the shorter arc from the debilitation point, divided by
 * three, so the whole 180 degrees maps onto 0-60.
 */
export function uchchaBala(planet: BalaPlanet, longitude: number): number {
  const debilitation = debilitationOf(planet);
  const point = (debilitation.sign - 1) * 30 + debilitation.degree;

  const separation = Math.abs(normalizeLongitude(longitude - point));
  const shorter = Math.min(separation, 360 - separation);

  return shorter / 3;
}

/**
 * Kendradi Bala: strength from the kind of house.
 *
 * Angles 60, succedents 30, cadents 15. Houses are counted from the ascendant.
 */
export function kendradiBala(house: number): number {
  const normalized = ((house - 1) % 12) + 1;
  if ([1, 4, 7, 10].includes(normalized)) return 60;
  if ([2, 5, 8, 11].includes(normalized)) return 30;
  return 15;
}

/**
 * Dig Bala: directional strength.
 *
 * Each planet is strongest in one quarter of the chart and weakest opposite it.
 * Jupiter and Mercury rise in the east, the Sun and Mars culminate in the
 * south, Saturn sets in the west, the Moon and Venus are strongest at the
 * north. Strength falls linearly with the angular distance from that point.
 */
const STRONGEST_HOUSE: Record<BalaPlanet, number> = {
  Jupiter: 1,
  Mercury: 1,
  Sun: 10,
  Mars: 10,
  Saturn: 7,
  Moon: 4,
  Venus: 4,
};

export function digBala(planet: BalaPlanet, longitude: number, ascendantLongitude: number): number {
  // The cusp the planet is measured against, as a longitude.
  const strongest = normalizeLongitude(ascendantLongitude + (STRONGEST_HOUSE[planet] - 1) * 30);

  const separation = Math.abs(normalizeLongitude(longitude - strongest));
  const shorter = Math.min(separation, 360 - separation);

  // Full strength at the point, none 180 degrees away.
  return ((180 - shorter) / 180) * 60;
}

/**
 * Ojhayugmarasyamsa Bala: odd and even, in sign and in navamsa.
 *
 * The Moon and Venus are strengthened by even signs, every other planet by odd
 * ones. Fifteen is available from the rashi and fifteen from the navamsa, so
 * the component runs 0 to 30.
 */
const PREFERS_EVEN: BalaPlanet[] = ["Moon", "Venus"];

export function ojhayugmaBala(planet: BalaPlanet, longitude: number): number {
  const wantsEven = PREFERS_EVEN.includes(planet);

  const rashiEven = getSignNumber(longitude) % 2 === 0;
  const navamsaEven = getVargaSign(longitude, 9) % 2 === 0;

  return (rashiEven === wantsEven ? 15 : 0) + (navamsaEven === wantsEven ? 15 : 0);
}

/**
 * Drekkana Bala: fifteen for a planet in the third of the sign that suits it.
 *
 * Male planets take the first drekkana, neuter the second, female the third.
 */
const DREKKANA_PART: Record<BalaPlanet, 0 | 1 | 2> = {
  Sun: 0,
  Mars: 0,
  Jupiter: 0,
  Mercury: 1,
  Saturn: 1,
  Moon: 2,
  Venus: 2,
};

export function drekkanaBala(planet: BalaPlanet, longitude: number): number {
  return getVargaIndex(longitude, 3) === DREKKANA_PART[planet] ? 15 : 0;
}

/**
 * Saptavargaja Bala: dignity across seven divisional charts.
 *
 * The planet's standing is scored in each of D1, D2, D3, D7, D9, D12 and D30,
 * and the seven are added. The weights are the BPHS table and halve down the
 * scale from own sign: 30, 22.5, 15, 7.5, 3.75, 1.875, with moolatrikona above
 * it at 45.
 *
 * Relationship with the varga sign's lord is the **compound** one - natural
 * plus temporal - and temporal friendship is read from the rashi chart, since
 * that is where the planets actually sit. A varga is a mapping of longitudes,
 * not a second sky with its own proximities.
 *
 * An earlier draft of the methodology called these weights unsettled. They are
 * not: the table below is standard, and it was the relationship input that
 * needed the friendship module before this could be written honestly.
 */
const SAPTAVARGA_DIVISIONS = [1, 2, 3, 7, 9, 12, 30] as const;

const DIGNITY_WEIGHT = {
  moolatrikona: 45,
  "own sign": 30,
  "great friend": 22.5,
  friend: 15,
  neutral: 7.5,
  enemy: 3.75,
  "great enemy": 1.875,
} as const;

/** The best score a planet could reach: moolatrikona in all seven. */
export const SAPTAVARGAJA_MAX = SAPTAVARGA_DIVISIONS.length * DIGNITY_WEIGHT.moolatrikona;

const MOOLATRIKONA_SIGN: Record<BalaPlanet, number> = {
  Sun: 5,
  Moon: 2,
  Mars: 1,
  Mercury: 6,
  Jupiter: 9,
  Venus: 7,
  Saturn: 11,
};

const isBalaPlanet = (planet: PlanetName): planet is BalaPlanet =>
  (BALA_PLANETS as readonly string[]).includes(planet);

export function saptavargajaBala(
  planet: BalaPlanet,
  longitude: number,
  rashiSigns: Record<string, number>,
): number {
  let total = 0;

  for (const division of SAPTAVARGA_DIVISIONS) {
    const sign = getVargaSign(longitude, division);
    const lord = getSignLord(sign);

    if (lord === planet) {
      // Moolatrikona outranks own sign, but only in the planet's own D1 arc;
      // in a division the sign alone is what there is to judge.
      total += division === 1 && sign === MOOLATRIKONA_SIGN[planet]
        ? DIGNITY_WEIGHT.moolatrikona
        : DIGNITY_WEIGHT["own sign"];
      continue;
    }

    if (!isBalaPlanet(lord)) {
      total += DIGNITY_WEIGHT.neutral;
      continue;
    }

    // Temporal friendship is read from where the planets actually sit, which is
    // the rashi chart - a varga has no proximities of its own.
    const natural = naturalRelation(planet as RelationshipPlanet, lord);
    const temporal = temporalRelation(rashiSigns[planet], rashiSigns[lord]);
    total += DIGNITY_WEIGHT[compoundRelation(natural, temporal)];
  }

  return total;
}

export type BalaComponents = {
  planet: BalaPlanet;
  sign: number;
  house: number;
  naisargika: number;
  saptavargaja: number;
  drik: number;
  uchcha: number;
  kendradi: number;
  dig: number;
  ojhayugma: number;
  drekkana: number;
  /**
   * The sum of the components above **only**. It is not Shadbala and must not
   * be labelled as such: Kala Bala, Chesta Bala and Drik Bala are absent.
   */
  partialTotal: number;
};

/** The calculable components, per planet. */
export function calculateBala(chart: VedicChartData): BalaComponents[] {
  if (typeof chart.ascendantLongitude !== "number") {
    throw new ChartDataError("Dig Bala needs the ascendant's exact degree, not only its sign.");
  }

  const ascendant = normalizeSign(chart.ascendantSign);

  // Where every planet sits in the rashi, which temporal friendship needs.
  const rashiSigns: Record<string, number> = {};
  for (const entry of chart.planets) rashiSigns[entry.planet] = normalizeSign(entry.sign);

  const natures = new Map(calculateBeneficNatures(chart).map((entry) => [entry.planet, entry.nature]));

  return BALA_PLANETS.map((name) => {
    const planet = chart.planets.find((entry) => entry.planet === (name as PlanetName));
    if (!planet) throw new ChartDataError(`Bala needs ${name}'s position.`);

    const house = ((normalizeSign(planet.sign) - ascendant + 12) % 12) + 1;

    const components = {
      naisargika: naisargikaBala(name),
      saptavargaja: saptavargajaBala(name, planet.longitude, rashiSigns),
      drik: drikBala(name, chart, natures),
      uchcha: uchchaBala(name, planet.longitude),
      kendradi: kendradiBala(house),
      dig: digBala(name, planet.longitude, chart.ascendantLongitude!),
      ojhayugma: ojhayugmaBala(name, planet.longitude),
      drekkana: drekkanaBala(name, planet.longitude),
    };

    return {
      planet: name,
      sign: normalizeSign(planet.sign),
      house,
      ...components,
      partialTotal:
        components.naisargika +
        components.saptavargaja +
        components.drik +
        components.uchcha +
        components.kendradi +
        components.dig +
        components.ojhayugma +
        components.drekkana,
    };
  });
}

/** Components that are calculated, for the UI to name honestly. */
export const IMPLEMENTED_BALAS = [
  "Naisargika",
  "Saptavargaja",
  "Drik",
  "Uchcha",
  "Kendradi",
  "Dig",
  "Ojhayugmarasyamsa",
  "Drekkana",
] as const;

/** Components that are not, and why. */
export const MISSING_BALAS = [
  "Kala Bala — its sub-components rest on epoch conventions that differ by authority",
  "Chesta Bala — needs true motion compared against mean motion",
] as const;

/** Degrees of a sign, exported so callers need not restate it. */
export const degreeOf = getDegreeInSign;

/**
 * Drik Bala: strength from being looked at.
 *
 * The virupas cast on a planet by benefics, less those cast by malefics,
 * divided by four. A planet surrounded by benefic aspects gains; one under
 * malefic aspects loses, and the figure is negative - which is correct and is
 * not clamped, since a negative Drik Bala is a real result.
 *
 * Both inputs are now calculable: the graded drishti table in `aspects.ts`, and
 * the benefic classification in `benefic.ts` with the Moon and Mercury judged
 * in context. Neither was available when this component was first deferred.
 */
export function drikBala(
  planet: BalaPlanet,
  chart: VedicChartData,
  natures: Map<string, Benefic>,
): number {
  const target = chart.planets.find((entry) => entry.planet === (planet as PlanetName));
  if (!target) return 0;

  let total = 0;

  for (const other of chart.planets) {
    if (other.planet === planet) continue;

    const virupas = drishtiStrength(other.planet, other.sign, target.sign);
    if (virupas === 0) continue;

    total += natures.get(other.planet) === "benefic" ? virupas : -virupas;
  }

  return total / 4;
}
