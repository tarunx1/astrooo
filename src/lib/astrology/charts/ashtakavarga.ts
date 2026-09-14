import type { PlanetName } from "@/config/astrology";
import { normalizeSign } from "@/lib/astrology/charts/signs";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Ashtakavarga: how much each sign is supported, counted rather than judged.
 *
 * Each of seven planets keeps its own score sheet. Eight reference points - the
 * same seven planets plus the Lagna - each award a point to a fixed set of
 * houses counted from wherever that reference point sits. Add the eight sheets
 * for one planet and you have its Bhinnashtakavarga; add the seven planets'
 * sheets sign by sign and you have the Sarvashtakavarga.
 *
 * Rahu and Ketu take no part. The classical system is built on eight
 * contributors and the nodes are not among them; including them would change
 * every total and make the results incomparable with any other source.
 *
 * The benefic-place tables below are the whole method. They are data, not
 * logic: the calculation is one loop, and everything that makes it Parashari
 * lives in these lists. See `docs/astrology-methodology.md`.
 */

/** The seven planets that hold an Ashtakavarga. Nodes excluded, by definition. */
export const ASHTAKAVARGA_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
] as const;

export type AshtakavargaPlanet = (typeof ASHTAKAVARGA_PLANETS)[number];

/** The eight contributors: the seven planets, then the ascendant. */
export const CONTRIBUTORS = [...ASHTAKAVARGA_PLANETS, "Lagna"] as const;

export type Contributor = (typeof CONTRIBUTORS)[number];

/**
 * Benefic places.
 *
 * Read as: in <planet>'s Ashtakavarga, counting from <contributor>, these
 * houses receive a point. Houses are 1-based and inclusive of the contributor's
 * own sign, so 1 means the sign the contributor occupies.
 */
const BENEFIC_PLACES: Record<AshtakavargaPlanet, Record<Contributor, readonly number[]>> = {
  Sun: {
    Sun: [1, 2, 4, 7, 8, 9, 10, 11],
    Moon: [3, 6, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [3, 5, 6, 9, 10, 11, 12],
    Jupiter: [5, 6, 9, 11],
    Venus: [6, 7, 12],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Lagna: [3, 4, 6, 10, 11, 12],
  },
  Moon: {
    Sun: [3, 6, 7, 8, 10, 11],
    Moon: [1, 3, 6, 7, 10, 11],
    Mars: [2, 3, 5, 6, 9, 10, 11],
    Mercury: [1, 3, 4, 5, 7, 8, 10, 11],
    Jupiter: [1, 4, 7, 8, 10, 11, 12],
    Venus: [3, 4, 5, 7, 9, 10, 11],
    Saturn: [3, 5, 6, 11],
    Lagna: [3, 6, 10, 11],
  },
  Mars: {
    Sun: [3, 5, 6, 10, 11],
    Moon: [3, 6, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [3, 5, 6, 11],
    Jupiter: [6, 10, 11, 12],
    Venus: [6, 8, 11, 12],
    Saturn: [1, 4, 7, 8, 9, 10, 11],
    Lagna: [1, 3, 6, 10, 11],
  },
  Mercury: {
    Sun: [5, 6, 9, 11, 12],
    Moon: [2, 4, 6, 8, 10, 11],
    Mars: [1, 2, 4, 7, 8, 9, 10, 11],
    Mercury: [1, 3, 5, 6, 9, 10, 11, 12],
    Jupiter: [6, 8, 11, 12],
    Venus: [1, 2, 3, 4, 5, 8, 9, 11],
    Saturn: [1, 2, 4, 7, 8, 9, 10, 11],
    Lagna: [1, 2, 4, 6, 8, 10, 11],
  },
  Jupiter: {
    Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Moon: [2, 5, 7, 9, 11],
    Mars: [1, 2, 4, 7, 8, 10, 11],
    Mercury: [1, 2, 4, 5, 6, 9, 10, 11],
    Jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
    Venus: [2, 5, 6, 9, 10, 11],
    Saturn: [3, 5, 6, 12],
    Lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Venus: {
    Sun: [8, 11, 12],
    Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Mars: [3, 5, 6, 9, 11, 12],
    Mercury: [3, 5, 6, 9, 11],
    Jupiter: [5, 8, 9, 10, 11],
    Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Saturn: [3, 4, 5, 8, 9, 10, 11],
    Lagna: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Saturn: {
    Sun: [1, 2, 4, 7, 8, 10, 11],
    Moon: [3, 6, 11],
    Mars: [3, 5, 6, 10, 11, 12],
    Mercury: [6, 8, 9, 10, 11, 12],
    Jupiter: [5, 6, 11, 12],
    Venus: [6, 11, 12],
    Saturn: [3, 5, 6, 11],
    Lagna: [1, 3, 4, 6, 10, 11],
  },
};

/**
 * Classical totals per planet, and their sum.
 *
 * A planet's total does not depend on the chart: each contributor awards a
 * fixed number of points wherever it happens to sit, so these are constants of
 * the system rather than results. They are the sharpest check available on the
 * tables above - a mistyped house shifts a total and is caught immediately -
 * and 337 is the figure every classical source gives for the Sarvashtakavarga.
 */
export const CLASSICAL_TOTALS: Record<AshtakavargaPlanet, number> = {
  Sun: 48,
  Moon: 49,
  Mars: 39,
  Mercury: 54,
  Jupiter: 56,
  Venus: 52,
  Saturn: 39,
};

export const CLASSICAL_SARVA_TOTAL = 337;

export type Bhinnashtakavarga = {
  planet: AshtakavargaPlanet;
  /** Bindus per sign, keyed 1-12. Each is 0-8. */
  bindus: Record<number, number>;
  /** Sum across all twelve signs. Always the planet's classical total. */
  total: number;
};

export type AshtakavargaResult = {
  bhinna: Bhinnashtakavarga[];
  /** Sarvashtakavarga: the seven sheets added sign by sign. */
  sarva: Record<number, number>;
  sarvaTotal: number;
};

/** Where each contributor sits, as a sign number 1-12. */
function contributorSigns(chart: VedicChartData): Record<Contributor, number> {
  const signs = {} as Record<Contributor, number>;

  for (const planet of ASHTAKAVARGA_PLANETS) {
    const found = chart.planets.find((entry) => entry.planet === (planet as PlanetName));
    if (!found) {
      throw new ChartDataError(`Ashtakavarga needs ${planet}'s position.`);
    }
    signs[planet] = normalizeSign(found.sign);
  }

  signs.Lagna = normalizeSign(chart.ascendantSign);
  return signs;
}

/** One planet's Bhinnashtakavarga. */
export function calculateBhinnashtakavarga(
  chart: VedicChartData,
  planet: AshtakavargaPlanet,
): Bhinnashtakavarga {
  const signs = contributorSigns(chart);
  const bindus: Record<number, number> = {};
  for (let sign = 1; sign <= 12; sign += 1) bindus[sign] = 0;

  for (const contributor of CONTRIBUTORS) {
    const from = signs[contributor];
    for (const house of BENEFIC_PLACES[planet][contributor]) {
      // Houses are inclusive of the contributor's own sign, so the 1st house is
      // that sign itself and the offset is house - 1.
      bindus[normalizeSign(from + house - 1)] += 1;
    }
  }

  const total = Object.values(bindus).reduce((sum, value) => sum + value, 0);
  return { planet, bindus, total };
}

/** All seven sheets and their sign-by-sign sum. */
export function calculateAshtakavarga(chart: VedicChartData): AshtakavargaResult {
  const bhinna = ASHTAKAVARGA_PLANETS.map((planet) => calculateBhinnashtakavarga(chart, planet));

  const sarva: Record<number, number> = {};
  for (let sign = 1; sign <= 12; sign += 1) {
    sarva[sign] = bhinna.reduce((sum, sheet) => sum + sheet.bindus[sign], 0);
  }

  return {
    bhinna,
    sarva,
    sarvaTotal: Object.values(sarva).reduce((sum, value) => sum + value, 0),
  };
}

export type PrastharaRow = {
  contributor: Contributor;
  /** 1 where this contributor gave the sign a bindu, 0 where it did not. */
  bindus: Record<number, 0 | 1>;
  /** How many this contributor gave. A constant of the tables. */
  total: number;
};

export type Prasthara = {
  planet: AshtakavargaPlanet;
  rows: PrastharaRow[];
  /** Column sums, which are the planet's Bhinnashtakavarga. */
  columnTotals: Record<number, number>;
  total: number;
};

/**
 * Prasthara: the Bhinnashtakavarga with its working shown.
 *
 * A Bhinnashtakavarga says a sign has five bindus. The prasthara says *which
 * five of the eight contributors gave them*, which is what an astrologer needs
 * to judge whether a count is well-founded or happens to be propped up by one
 * reference point.
 *
 * This is the grid only. The **shodhana** - the Trikona and Ekadhipatya
 * reductions applied to it - is deliberately not implemented: those have
 * genuinely variant readings, whereas the grid itself is simply the data the
 * sheet was already built from and cannot be contentious.
 *
 * Because the columns sum to the Bhinnashtakavarga by construction, the grid
 * checks itself against a number that is in turn checked against the classical
 * total. A mistake cannot hide in one cell.
 */
export function calculatePrasthara(
  chart: VedicChartData,
  planet: AshtakavargaPlanet,
): Prasthara {
  const signs = contributorSigns(chart);

  const rows: PrastharaRow[] = CONTRIBUTORS.map((contributor) => {
    const bindus: Record<number, 0 | 1> = {};
    for (let sign = 1; sign <= 12; sign += 1) bindus[sign] = 0;

    for (const house of BENEFIC_PLACES[planet][contributor]) {
      bindus[normalizeSign(signs[contributor] + house - 1)] = 1;
    }

    return {
      contributor,
      bindus,
      total: Object.values(bindus).reduce((sum: number, value) => sum + value, 0),
    };
  });

  const columnTotals: Record<number, number> = {};
  for (let sign = 1; sign <= 12; sign += 1) {
    columnTotals[sign] = rows.reduce((sum, row) => sum + row.bindus[sign], 0);
  }

  return {
    planet,
    rows,
    columnTotals,
    total: Object.values(columnTotals).reduce((sum, value) => sum + value, 0),
  };
}
