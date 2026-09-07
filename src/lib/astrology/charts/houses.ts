import { PLANETS } from "@/config/astrology";
import { getSignName, normalizeSign, SIGNS_IN_ZODIAC } from "@/lib/astrology/charts/signs";
import type { ChartHouse, ChartPlanet, VedicChartData } from "@/lib/astrology/charts/types";

/**
 * House placement.
 *
 * Whole-sign houses, which is what the rest of this product assumes: the
 * ascendant's sign is the first house and the remaining signs follow in order.
 * That makes placement pure arithmetic on sign numbers, independent of any
 * geometry, so the same result holds however the chart is later drawn.
 */

/** Which sign occupies a given house, for a given ascendant. */
export function getHouseSign(ascendantSign: number, house: number): number {
  return normalizeSign(normalizeSign(ascendantSign) + (house - 1));
}

/** Which house a sign falls in, for a given ascendant. Always 1-12. */
export function getHouseFromSign(planetSign: number, ascendantSign: number): number {
  const offset = normalizeSign(planetSign) - normalizeSign(ascendantSign);
  return ((offset % SIGNS_IN_ZODIAC) + SIGNS_IN_ZODIAC) % SIGNS_IN_ZODIAC + 1;
}

/**
 * Traditional display order.
 *
 * Grouping must not depend on the order planets happen to arrive in, or the
 * same chart would render differently between a live calculation and a stored
 * one. `PLANETS` is already in the conventional sequence.
 */
const PLANET_ORDER = new Map(PLANETS.map((planet, index) => [planet, index]));

export function sortPlanetsForDisplay(planets: readonly ChartPlanet[]): ChartPlanet[] {
  return [...planets].sort((a, b) => {
    const order = (PLANET_ORDER.get(a.planet) ?? 99) - (PLANET_ORDER.get(b.planet) ?? 99);
    // A stable tie-break, so two unknown bodies never swap between renders.
    return order !== 0 ? order : a.planet.localeCompare(b.planet);
  });
}

/** The twelve houses of a chart, each with its sign and its occupants. */
export function buildHouses(chart: VedicChartData): ChartHouse[] {
  const houses: ChartHouse[] = [];

  for (let house = 1; house <= SIGNS_IN_ZODIAC; house += 1) {
    const sign = getHouseSign(chart.ascendantSign, house);

    houses.push({
      house,
      sign,
      signName: getSignName(sign),
      planets: sortPlanetsForDisplay(
        chart.planets.filter((planet) => normalizeSign(planet.sign) === sign),
      ),
    });
  }

  return houses;
}

/** Planets keyed by house number. Every house is present, even when empty. */
export function groupPlanetsByHouse(chart: VedicChartData): Record<number, ChartPlanet[]> {
  const grouped: Record<number, ChartPlanet[]> = {};
  for (const house of buildHouses(chart)) grouped[house.house] = house.planets;
  return grouped;
}
