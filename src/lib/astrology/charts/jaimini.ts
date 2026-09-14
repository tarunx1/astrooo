import type { PlanetName } from "@/config/astrology";
import { getDegreeInSign, normalizeSign } from "@/lib/astrology/charts/signs";
import { getSignLord } from "@/lib/astrology/kp/vimshottari";
import { getVargaSign } from "@/lib/astrology/charts/varga";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Jaimini: the chara karakas and the arudha padas.
 *
 * Both are pure arithmetic on positions already calculated, and both have a
 * documented fork in the tradition. Where that happens the choice is named here
 * and in `docs/astrology-methodology.md` rather than being made silently - the
 * brief is explicit that traditions must not be quietly combined.
 */

/**
 * The eight chara karakas, strongest first.
 *
 * This software uses the **eight-karaka scheme**, which includes Rahu. The
 * seven-karaka scheme excluding it is also current; it drops Putrakaraka and
 * shifts the rest up. The two give different answers for the same chart, so
 * mixing them would be worse than either.
 */
export const CHARA_KARAKAS = [
  "Atmakaraka",
  "Amatyakaraka",
  "Bhratrikaraka",
  "Matrikaraka",
  "Putrakaraka",
  "Pitrikaraka",
  "Gnatikaraka",
  "Darakaraka",
] as const;

export type CharaKaraka = (typeof CHARA_KARAKAS)[number];

/** The planets that take a chara karaka. Ketu is not among them. */
const KARAKA_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
] as const;

export type CharaKarakaAssignment = {
  karaka: CharaKaraka;
  planet: PlanetName;
  /** The degree the ranking used, after Rahu's reversal. */
  rankingDegree: number;
  /** The plain degree in its sign, before any reversal. */
  degreeInSign: number;
};

/**
 * Chara karakas, by degree within sign.
 *
 * The planet furthest through its sign is the Atmakaraka, and the rest follow
 * in descending order. **Rahu is counted in reverse** - 30 minus its degree -
 * because it moves backwards through the zodiac, so the sign it has travelled
 * furthest through is the one it has least of remaining. Ketu takes no karaka.
 */
export function calculateCharaKarakas(chart: VedicChartData): CharaKarakaAssignment[] {
  const ranked = KARAKA_PLANETS.map((name) => {
    const planet = chart.planets.find((entry) => entry.planet === (name as PlanetName));
    if (!planet) throw new ChartDataError(`Chara karakas need ${name}'s position.`);

    const degreeInSign = getDegreeInSign(planet.longitude);

    return {
      planet: planet.planet,
      degreeInSign,
      rankingDegree: name === "Rahu" ? 30 - degreeInSign : degreeInSign,
    };
  }).sort((a, b) => {
    if (b.rankingDegree !== a.rankingDegree) return b.rankingDegree - a.rankingDegree;
    // An exact tie is vanishingly unlikely at full precision, but the order
    // must not depend on array order if it happens.
    return a.planet.localeCompare(b.planet);
  });

  return ranked.map((entry, index) => ({ karaka: CHARA_KARAKAS[index], ...entry }));
}

export type ArudhaPada = {
  /** House whose pada this is, 1-12. */
  house: number;
  /** Sign the house occupies. */
  houseSign: number;
  lord: PlanetName;
  lordSign: number;
  /** The resulting pada sign. */
  sign: number;
  /** True when the 1st/7th exception moved it. */
  adjusted: boolean;
};

/**
 * The arudha pada of one house.
 *
 * Count from the house to its lord, then the same distance again from the lord.
 * A pada may not rest in the house itself or in the seventh from it - a
 * reflection cannot fall on its own source or directly opposite it - so in
 * either case it is moved to the tenth from where it landed.
 */
export function arudhaOf(houseSign: number, lordSign: number): { sign: number; adjusted: boolean } {
  const from = normalizeSign(houseSign);
  const lord = normalizeSign(lordSign);

  // Inclusive count, so a lord in its own sign is a distance of 1.
  const distance = ((lord - from + 12) % 12) + 1;
  const landed = normalizeSign(lord + distance - 1);

  const isSelf = landed === from;
  const isSeventh = landed === normalizeSign(from + 6);

  return isSelf || isSeventh
    ? { sign: normalizeSign(landed + 9), adjusted: true }
    : { sign: landed, adjusted: false };
}

/**
 * All twelve arudha padas.
 *
 * A1 is the Arudha Lagna and A12 the Upapada; the rest are named by number,
 * which is how they are referred to in practice.
 */
export function calculateArudhaPadas(chart: VedicChartData): ArudhaPada[] {
  const ascendant = normalizeSign(chart.ascendantSign);

  return Array.from({ length: 12 }, (_, index) => {
    const house = index + 1;
    const houseSign = normalizeSign(ascendant + index);
    const lord = getSignLord(houseSign);

    const lordPlanet = chart.planets.find((entry) => entry.planet === lord);
    if (!lordPlanet) throw new ChartDataError(`An arudha pada needs ${lord}'s position.`);

    const lordSign = normalizeSign(lordPlanet.sign);
    const { sign, adjusted } = arudhaOf(houseSign, lordSign);

    return { house, houseSign, lord, lordSign, sign, adjusted };
  });
}

/**
 * Karakamsa and Swamsa.
 *
 * Both rest on one value: the sign the Atmakaraka occupies in the Navamsa. The
 * difference is which chart that sign is then read as the lagna of.
 *
 *   Karakamsa - that sign taken as the lagna of the **Rashi** chart
 *   Swamsa    - that sign taken as the lagna of the **Navamsa** chart
 *
 * The two names are used inconsistently in the literature, and some authors
 * swap them outright. The definitions above are the ones this software uses and
 * they are recorded in `docs/astrology-methodology.md`; nothing is inferred
 * from context at the call site.
 */
export type KarakamsaResult = {
  /** The planet holding the Atmakaraka. */
  atmakaraka: PlanetName;
  /** The Atmakaraka's navamsa sign, which both charts are read from. */
  sign: number;
};

export function calculateKarakamsa(chart: VedicChartData): KarakamsaResult {
  const [atma] = calculateCharaKarakas(chart);

  const planet = chart.planets.find((entry) => entry.planet === atma.planet);
  if (!planet) throw new ChartDataError("Karakamsa needs the Atmakaraka's position.");

  return { atmakaraka: atma.planet, sign: getVargaSign(planet.longitude, 9) };
}
