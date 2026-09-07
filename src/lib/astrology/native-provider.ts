import { SIGNS, astrologyCalculationConfig } from "@/config/astrology";
import type { AstrologyProvider, AstrologyProviderMetadata } from "@/lib/astrology/provider";
import { computeChartForBirth, type SiderealChart } from "@/lib/astrology/engine/chart";
import { buildDashaTimeline, dashaChainAt, formatBalance } from "@/lib/astrology/engine/dasha";
import { createKundliInputHash } from "@/lib/kundli/normalize";
import type { KundliHouse, KundliResult, NormalizedBirthDetails, PlanetPosition } from "@/lib/kundli/types";

/**
 * The astrology provider, computed here rather than fetched.
 *
 * Everything this returns comes from our own ephemeris: VSOP87 for the
 * planets, ELP 2000-82B for the Moon, verified against JPL Horizons. There is
 * no network call, so a chart cannot fail because someone else's service is
 * down, cannot be rate limited, and cannot silently change under us.
 *
 * It is also the reason this file can state its own limitations honestly:
 * they are properties of code in this repository rather than of an API whose
 * behaviour we could only infer.
 */
export class NativeAstrologyProvider implements AstrologyProvider {
  readonly metadata: AstrologyProviderMetadata = {
    provider: "ravish-engine",
    providerVersion: "vsop87d+elp2000-82b",
    calculationVersion: astrologyCalculationConfig.version,
    ayanamsa: astrologyCalculationConfig.ayanamsa,
    houseSystem: "WHOLE_SIGN",
    isDevelopmentFixture: false,
    limitations: [
      "Yoga detection is returned as an empty list until deterministic production rules are added.",
      "Manglik status is derived from the placement of Mars alone, without the exceptions and cancellations a practitioner would apply.",
    ],
  };

  private chartFor(input: NormalizedBirthDetails): SiderealChart {
    return computeChartForBirth(
      { dateOfBirth: input.dateOfBirth, timeOfBirth: input.timeOfBirth },
      {
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        timezone: input.location.timezone,
      },
    );
  }

  async calculateKundli(input: NormalizedBirthDetails): Promise<KundliResult> {
    return this.generateBirthChart(input);
  }

  async generateBirthChart(input: NormalizedBirthDetails): Promise<KundliResult> {
    const chart = this.chartFor(input);
    const planets = toPlanetPositions(chart);

    const moon = planets.find((planet) => planet.planet === "Moon")!;
    const sun = planets.find((planet) => planet.planet === "Sun")!;

    const houses: KundliHouse[] = Array.from({ length: 12 }, (_, index) => {
      const house = index + 1;
      const signIndex = (SIGNS.indexOf(chart.ascendant.sign) + index) % 12;
      return {
        house,
        sign: SIGNS[signIndex],
        planets: planets.filter((planet) => planet.house === house).map((planet) => planet.planet),
      };
    });

    return {
      metadata: {
        inputHash: createKundliInputHash(input),
        createdAt: new Date().toISOString(),
      },
      person: {
        name: input.name,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth,
        timeOfBirth: input.timeOfBirth,
        timeAccuracy: input.timeAccuracy,
      },
      location: input.location,
      ascendant: {
        sign: chart.ascendant.sign,
        degree: round(chart.ascendant.degreeInSign),
      },
      sunSign: sun.sign,
      moonSign: moon.sign,
      nakshatra: { name: moon.nakshatra, pada: moon.nakshatraPada },
      planets,
      houses,
      chart: { style: "NORTH_INDIAN", houses },
      vimshottariDasha: this.dashaFor(chart),
      manglik: manglikFrom(planets),
      yogas: [],
      calculationMetadata: {
        ...this.metadata,
        calculatedAt: new Date().toISOString(),
      },
    };
  }

  async getPlanetaryPositions(input: NormalizedBirthDetails): Promise<PlanetPosition[]> {
    return toPlanetPositions(this.chartFor(input));
  }

  async getPanchang(): Promise<never> {
    // Panchang is served by the tools provider, which needs a date and place
    // rather than a birth record. This method exists only to satisfy the
    // interface, and saying so is better than returning an empty shape.
    throw new Error("Panchang is calculated by the astrology tools provider, not from a birth record.");
  }

  async getVimshottariDasha(input: NormalizedBirthDetails): Promise<KundliResult["vimshottariDasha"]> {
    return this.dashaFor(this.chartFor(input));
  }

  async getMoonSign(input: NormalizedBirthDetails): Promise<string> {
    return this.chartFor(input).planets.find((planet) => planet.planet === "Moon")!.sign;
  }

  async getNakshatra(input: NormalizedBirthDetails): Promise<KundliResult["nakshatra"]> {
    const moon = this.chartFor(input).planets.find((planet) => planet.planet === "Moon")!;
    return { name: moon.nakshatra, pada: moon.nakshatraPada };
  }

  /** The dasha in force at the moment of birth. */
  private dashaFor(chart: SiderealChart): KundliResult["vimshottariDasha"] {
    const moon = chart.planets.find((planet) => planet.planet === "Moon")!;
    const timeline = buildDashaTimeline(chart.instant, moon.longitude, 2);
    const chain = dashaChainAt(timeline, chart.instant);

    return {
      currentMahadasha: chain[0]?.lord ?? timeline.birthLord,
      currentAntardasha: chain[1]?.lord ?? timeline.birthLord,
      balance: formatBalance(timeline.balanceYears),
    };
  }
}

/** Two decimal places, which is the precision a chart is read to. */
const round = (value: number) => Math.round(value * 100) / 100;

function toPlanetPositions(chart: SiderealChart): PlanetPosition[] {
  return chart.planets.map((planet) => ({
    planet: planet.planet,
    longitude: round(planet.longitude),
    latitude: round(planet.latitude),
    sign: planet.sign,
    degreeInSign: round(planet.degreeInSign),
    house: planet.house,
    nakshatra: planet.nakshatra,
    nakshatraPada: planet.nakshatraPada,
    retrograde: planet.retrograde,
  }));
}

/**
 * Manglik status from the placement of Mars.
 *
 * Mars in the first, fourth, seventh, eighth or twelfth house from the
 * ascendant is the classical rule. Practitioners apply exceptions and
 * cancellations this does not model, which is why the summary says where the
 * answer came from rather than presenting it as a verdict.
 */
function manglikFrom(planets: PlanetPosition[]): KundliResult["manglik"] {
  const marsHouse = planets.find((planet) => planet.planet === "Mars")?.house;
  const isManglik = marsHouse !== undefined && [1, 4, 7, 8, 12].includes(marsHouse);

  return {
    status: isManglik ? "Manglik" : "Non-Manglik",
    summary: isManglik
      ? `Mars falls in house ${marsHouse} from the ascendant, one of the placements the classical rule counts. Exceptions and cancellations are not applied here.`
      : `Mars falls in house ${marsHouse}, which is not one of houses 1, 4, 7, 8 or 12 counted by the classical rule.`,
  };
}
