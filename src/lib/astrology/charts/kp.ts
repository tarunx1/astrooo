import { sortPlanetsForDisplay } from "@/lib/astrology/charts/houses";
import { getSignNumber } from "@/lib/astrology/charts/signs";
import type { ChartHouse, ChartPlanet, VedicChartData } from "@/lib/astrology/charts/types";
import type { KpChart } from "@/lib/astrology/kp/chart";

/** Preserve the engine's Placidus houses and actual planetary longitudes. */
export function createKpChartDisplay(chart: KpChart): { data: VedicChartData; houses: ChartHouse[] } {
  const planets: ChartPlanet[] = chart.planets.map((planet) => ({
    planet: planet.planet,
    longitude: planet.longitude,
    sign: getSignNumber(planet.longitude),
    degreeInSign: planet.degreeInSign,
    retrograde: planet.retrograde,
  }));
  const placements = new Map(chart.planets.map((planet) => [planet.planet, planet.house]));

  return {
    data: {
      chartType: "KP",
      ascendantSign: getSignNumber(chart.cusps[0].longitude),
      ascendantLongitude: chart.cusps[0].longitude,
      planets,
      calculatedAt: chart.instant.toISOString(),
    },
    houses: chart.cusps.map((cusp) => ({
      house: cusp.house,
      sign: getSignNumber(cusp.longitude),
      signName: cusp.sign,
      planets: sortPlanetsForDisplay(planets.filter((planet) => placements.get(planet.planet) === cusp.house)),
    })),
  };
}
