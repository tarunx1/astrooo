import type { PlanetName } from "@/config/astrology";
import {
  VARGA_DEFINITIONS,
  calculateVarga,
  getVargaDefinition,
} from "@/lib/astrology/charts/varga";
import {
  getDegreeInSign,
  getSignNumber,
  getSignNumberFromName,
  normalizeLongitude,
  normalizeSign,
} from "@/lib/astrology/charts/signs";
import { ChartDataError, type ChartPlanet, type VedicChartData } from "@/lib/astrology/charts/types";
import type { KundliResult, PlanetPosition } from "@/lib/kundli/types";

/**
 * Turning a calculation into a chart.
 *
 * These are the only places a provider result becomes chart data. Each is a
 * pure function of its input, so the same stored calculation always produces
 * the same chart - which is what makes a historical report reproducible and a
 * rendered chart cacheable.
 *
 * Signs and degrees are derived here from longitude rather than taken from
 * whatever the provider labelled them: the longitude is the fact, and the
 * label is that provider's interpretation of it.
 */

/** How far apart Rahu and Ketu should be. They are always opposite. */
const NODE_OPPOSITION_TOLERANCE = 1;

function toChartPlanet(position: Pick<PlanetPosition, "planet" | "longitude" | "retrograde">): ChartPlanet {
  const longitude = normalizeLongitude(position.longitude);

  return {
    planet: position.planet,
    longitude,
    sign: getSignNumber(longitude),
    degreeInSign: getDegreeInSign(longitude),
    retrograde: Boolean(position.retrograde),
  };
}

/**
 * Structural checks on a set of positions.
 *
 * Returns warnings rather than throwing. A chart with an odd node separation is
 * still worth drawing - refusing to render would hide the problem from the one
 * person who could act on it - but the inconsistency is surfaced rather than
 * quietly rendered as fact. Provider values are never rewritten.
 */
export function validateChartPlanets(planets: readonly ChartPlanet[]): string[] {
  const warnings: string[] = [];
  const seen = new Set<PlanetName>();

  for (const planet of planets) {
    if (seen.has(planet.planet)) warnings.push(`${planet.planet} appears more than once.`);
    seen.add(planet.planet);
  }

  const rahu = planets.find((planet) => planet.planet === "Rahu");
  const ketu = planets.find((planet) => planet.planet === "Ketu");

  if (rahu && ketu) {
    const separation = Math.abs(normalizeLongitude(rahu.longitude - ketu.longitude) - 180);
    if (separation > NODE_OPPOSITION_TOLERANCE) {
      warnings.push(
        `Rahu and Ketu are ${(180 - separation).toFixed(2)}° apart rather than 180°, which suggests inconsistent source data.`,
      );
    }
  }

  return warnings;
}

/** The D1 Rashi chart: signs and houses exactly as calculated. */
export function createRashiChart(result: {
  ascendant: { sign: string; degree?: number };
  planets: readonly Pick<PlanetPosition, "planet" | "longitude" | "retrograde">[];
  calculatedAt?: string;
}): VedicChartData {
  if (!result.ascendant?.sign) {
    throw new ChartDataError("A chart needs an ascendant sign.");
  }

  const ascendantSign = getSignNumberFromName(result.ascendant.sign);

  return {
    chartType: "D1",
    ascendantSign,
    ascendantLongitude:
      typeof result.ascendant.degree === "number"
        ? normalizeLongitude((ascendantSign - 1) * 30 + result.ascendant.degree)
        : undefined,
    planets: result.planets.map(toChartPlanet),
    calculatedAt: result.calculatedAt,
  };
}

/**
 * The D9 Navamsa chart.
 *
 * Built from the same longitudes as the D1, with the navamsa transformation
 * applied to every planet and to the ascendant. The result is an ordinary
 * chart, so the renderer neither knows nor cares that it is a division.
 *
 * Requires an ascendant longitude: the D9 ascendant is the navamsa of the exact
 * rising degree, and a sign alone cannot produce it.
 */
export function createNavamsaChart(chart: VedicChartData): VedicChartData {
  if (typeof chart.ascendantLongitude !== "number") {
    throw new ChartDataError("A Navamsa chart needs the ascendant's exact degree, not only its sign.");
  }

  // The D9 is one of the sixteen, so it goes through the same engine as the
  // rest. Kept as a named function because callers and tests already speak of
  // it by name, but there is no second navamsa implementation behind it.
  return createDivisionalChart(chart, 9);
}

/**
 * Any divisional chart, from the same longitudes as the D1.
 *
 * The transformation is applied to every planet and to the ascendant, and what
 * comes out is an ordinary chart - so the renderer neither knows nor cares that
 * it is a division. That is what lets one `<VedicChart />` draw all sixteen.
 *
 * Requires the ascendant's exact degree. A varga ascendant is the division of
 * the precise rising degree, and a sign alone cannot produce it: Aries rising
 * at 2° and at 28° give different D9 ascendants. Throwing is better than
 * quietly charting the sign's first division as though it were the answer.
 */
export function createDivisionalChart(chart: VedicChartData, division: number): VedicChartData {
  // Confirms the division exists before any work, so an unsupported one fails
  // by name rather than by producing an empty chart.
  const definition = getVargaDefinition(division);

  if (division === 1) {
    return { ...chart, chartType: "D1" };
  }

  if (typeof chart.ascendantLongitude !== "number") {
    throw new ChartDataError(
      `A ${definition.name} (D${division}) chart needs the ascendant's exact degree, not only its sign.`,
    );
  }

  return {
    chartType: `D${division}`,
    ascendantSign: calculateVarga(chart.ascendantLongitude, division).sign,
    planets: chart.planets.map((planet) => {
      const varga = calculateVarga(planet.longitude, division);

      return {
        ...planet,
        // The longitude is kept so the source degree stays inspectable; the
        // sign is the divisional one, which is what placement uses.
        sign: varga.sign,
        // The degree has to move with the sign. Left at the Rashi value it
        // would be displayed against a sign it does not describe.
        degreeInSign: varga.degreeInSign,
      };
    }),
    calculatedAt: chart.calculatedAt,
  };
}

export type ShodashvargaRow = {
  planet: PlanetName;
  /** Divisional sign number, 1-12, keyed by division. */
  signs: Record<number, number>;
};

export type Shodashvarga = {
  divisions: readonly { division: number; name: string; significance: string }[];
  rows: ShodashvargaRow[];
  /** The ascendant across the same divisions. */
  ascendant: Record<number, number>;
};

/**
 * Every planet across every division, as one table.
 *
 * Computed in a single pass rather than by building sixteen charts and reading
 * them back, because the table only needs the sign - and an astrologer reading
 * across a row is the main reason this view exists.
 */
export function createShodashvarga(chart: VedicChartData): Shodashvarga {
  const divisions = VARGA_DEFINITIONS.map(({ division, name, significance }) => ({
    division,
    name,
    significance,
  }));

  const ascendant: Record<number, number> = {};
  if (typeof chart.ascendantLongitude === "number") {
    for (const { division } of divisions) {
      ascendant[division] = calculateVarga(chart.ascendantLongitude, division).sign;
    }
  }

  const rows = chart.planets.map((planet) => {
    const signs: Record<number, number> = {};
    for (const { division } of divisions) {
      signs[division] = calculateVarga(planet.longitude, division).sign;
    }
    return { planet: planet.planet, signs };
  });

  return { divisions, rows, ascendant };
}

/**
 * The Moon chart (Chandra Lagna).
 *
 * The Moon's sign becomes the first house; every planet keeps its Rashi sign.
 * No new astronomy is involved, only a different reference point.
 */
export function createMoonChart(chart: VedicChartData): VedicChartData {
  const moon = chart.planets.find((planet) => planet.planet === "Moon");
  if (!moon) throw new ChartDataError("A Moon chart needs the Moon's position.");

  return {
    chartType: "MOON",
    ascendantSign: normalizeSign(moon.sign),
    planets: chart.planets,
    calculatedAt: chart.calculatedAt,
  };
}

/** Convenience for the common case of charting a stored Kundli result. */
export function createChartsFromKundli(result: KundliResult): {
  rashi: VedicChartData;
  navamsa: VedicChartData | null;
  moon: VedicChartData;
  warnings: string[];
} {
  const rashi = createRashiChart({
    ascendant: result.ascendant,
    planets: result.planets,
    calculatedAt: result.metadata.createdAt,
  });

  let navamsa: VedicChartData | null = null;
  try {
    navamsa = createNavamsaChart(rashi);
  } catch {
    // Without an ascendant degree the D9 simply is not available. Offering an
    // approximate one would be worse than offering none.
    navamsa = null;
  }

  return { rashi, navamsa, moon: createMoonChart(rashi), warnings: validateChartPlanets(rashi.planets) };
}

/**
 * Gochar: transiting planets read against a natal chart.
 *
 * The chart keeps the natal ascendant, so a transiting planet appears in the
 * house it is transiting *for this person* rather than in an abstract sign
 * position. That reference point is the whole difference between a transit
 * table and a reading.
 *
 * The natal ascendant must be supplied. Deriving one from the current moment
 * would silently answer a different question - where the planets are now
 * relative to now - and look identical on screen.
 */
export function createTransitChart(input: {
  natalAscendantSign: number;
  transits: readonly { planet: PlanetName; longitude: number; retrograde?: boolean }[];
  calculatedAt?: string;
}): VedicChartData {
  return {
    chartType: "GOCHAR",
    ascendantSign: normalizeSign(input.natalAscendantSign),
    planets: input.transits.map((transit) =>
      toChartPlanet({ planet: transit.planet, longitude: transit.longitude, retrograde: Boolean(transit.retrograde) }),
    ),
    calculatedAt: input.calculatedAt,
  };
}
