import { NAKSHATRAS, PLANETS, SIGNS, astrologyCalculationConfig, getConfiguredAstrologyProviderName } from "@/config/astrology";
import { AstrologyProviderError } from "@/lib/astrology/errors";
import { NativeAstrologyProvider } from "@/lib/astrology/native-provider";
import type { KundliResult, NormalizedBirthDetails, PlanetPosition } from "@/lib/kundli/types";
import { createKundliInputHash } from "@/lib/kundli/normalize";

export type BirthDetails = {
  name: string;
  date: string;
  time: string;
  place: string;
  latitude?: number;
  longitude?: number;
};

export type AstrologyProviderMetadata = {
  provider: string;
  providerVersion: string;
  calculationVersion: string;
  ayanamsa: string;
  houseSystem: string;
  isDevelopmentFixture: boolean;
  limitations: string[];
};

export interface AstrologyProvider {
  readonly metadata: AstrologyProviderMetadata;
  calculateKundli(input: NormalizedBirthDetails): Promise<KundliResult>;
  generateBirthChart(input: NormalizedBirthDetails): Promise<KundliResult>;
  getPlanetaryPositions(input: NormalizedBirthDetails): Promise<PlanetPosition[]>;
  getPanchang(input: NormalizedBirthDetails): Promise<never>;
  getVimshottariDasha(input: NormalizedBirthDetails): Promise<KundliResult["vimshottariDasha"]>;
  getMoonSign(input: NormalizedBirthDetails): Promise<string>;
  getNakshatra(input: NormalizedBirthDetails): Promise<KundliResult["nakshatra"]>;
}

export class DevelopmentAstrologyProvider implements AstrologyProvider {
  readonly metadata: AstrologyProviderMetadata = {
    provider: "development-fixture",
    providerVersion: "1.0.0",
    calculationVersion: astrologyCalculationConfig.version,
    ayanamsa: astrologyCalculationConfig.ayanamsa,
    houseSystem: astrologyCalculationConfig.houseSystem,
    isDevelopmentFixture: true,
    limitations: [
      "Deterministic fixture for application development only.",
      "Not a real astronomical or Vedic astrology calculation.",
      "Replace behind AstrologyProvider before production astrology claims.",
    ],
  };

  async calculateKundli(input: NormalizedBirthDetails): Promise<KundliResult> {
    return this.generateBirthChart(input);
  }

  async generateBirthChart(input: NormalizedBirthDetails): Promise<KundliResult> {
    const inputHash = createKundliInputHash(input);
    const seed = parseInt(inputHash.slice(0, 8), 16);
    const ascendantIndex = seed % 12;
    const moonIndex = (seed >> 3) % 12;
    const sunIndex = (seed >> 7) % 12;
    const moonNakshatraIndex = (seed >> 5) % NAKSHATRAS.length;
    const planets = createPlanetPositions(seed, ascendantIndex);
    const houses = SIGNS.map((_, index) => {
      const sign = SIGNS[(ascendantIndex + index) % 12];
      return {
        house: index + 1,
        sign,
        planets: planets.filter((planet) => planet.house === index + 1).map((planet) => planet.planet),
      };
    });
    const calculatedAt = new Date().toISOString();

    return {
      metadata: {
        inputHash,
        createdAt: calculatedAt,
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
        sign: SIGNS[ascendantIndex],
        degree: roundDegree((seed % 3000) / 100),
      },
      sunSign: SIGNS[sunIndex],
      moonSign: SIGNS[moonIndex],
      nakshatra: {
        name: NAKSHATRAS[moonNakshatraIndex],
        pada: ((seed >> 9) % 4) + 1,
      },
      planets,
      houses,
      chart: {
        style: "NORTH_INDIAN",
        houses,
      },
      vimshottariDasha: {
        currentMahadasha: PLANETS[seed % PLANETS.length],
        currentAntardasha: PLANETS[(seed >> 4) % PLANETS.length],
        balance: `${((seed >> 8) % 7) + 1} years ${((seed >> 12) % 11) + 1} months`,
      },
      manglik: {
        status: [1, 4, 7, 8, 12].includes(planets.find((planet) => planet.planet === "Mars")?.house ?? 0) ? "Requires Review" : "Non-Manglik",
        summary: "Fixture marker only. A verified astrology engine must assess Manglik status before production use.",
      },
      yogas: [
        {
          name: "Development Fixture",
          summary: "Yoga detection is intentionally isolated until the real astrology provider is integrated.",
        },
      ],
      calculationMetadata: {
        ...this.metadata,
        calculatedAt,
      },
    };
  }

  async getPlanetaryPositions(input: NormalizedBirthDetails) {
    return (await this.generateBirthChart(input)).planets;
  }

  async getPanchang(): Promise<never> {
    throw unsupportedProviderMethod("getPanchang");
  }

  async getVimshottariDasha(input: NormalizedBirthDetails) {
    return (await this.generateBirthChart(input)).vimshottariDasha;
  }

  async getMoonSign(input: NormalizedBirthDetails) {
    return (await this.generateBirthChart(input)).moonSign;
  }

  async getNakshatra(input: NormalizedBirthDetails) {
    return (await this.generateBirthChart(input)).nakshatra;
  }
}

export function getAstrologyProvider(): AstrologyProvider {
  const provider = getConfiguredAstrologyProviderName();
  if (provider === "development") {
    if (process.env.NODE_ENV === "production") {
      throw new AstrologyProviderError({
        code: "CONFIGURATION",
        provider: "development",
        message: "Development astrology provider is disabled in production.",
        userMessage: "The Kundli calculation service is not configured.",
      });
    }
    return new DevelopmentAstrologyProvider();
  }
  return new NativeAstrologyProvider();
}

function createPlanetPositions(seed: number, ascendantIndex: number): PlanetPosition[] {
  return PLANETS.map((planet, index) => {
    const longitude = ((seed >> (index % 12)) + index * 37.42) % 360;
    const signIndex = Math.floor(longitude / 30);
    const nakshatraIndex = Math.floor(longitude / (360 / 27));
    return {
      planet,
      longitude: roundDegree(longitude),
      latitude: planet === "Rahu" || planet === "Ketu" ? 0 : roundDegree((((seed >> (index + 2)) % 900) - 450) / 100),
      sign: SIGNS[signIndex],
      degreeInSign: roundDegree(longitude % 30),
      house: ((signIndex - ascendantIndex + 12) % 12) + 1,
      nakshatra: NAKSHATRAS[nakshatraIndex],
      nakshatraPada: (Math.floor((longitude % (360 / 27)) / (360 / 108)) % 4) + 1,
      retrograde: index > 1 && ((seed >> index) & 1) === 1,
    };
  });
}

function unsupportedProviderMethod(operation: string): AstrologyProviderError {
  return new AstrologyProviderError({
    code: "CONFIGURATION",
    provider: "development-fixture",
    operation,
    message: `${operation} is not implemented for the current phase.`,
    userMessage: "This astrology calculation is not available yet.",
  });
}

function roundDegree(value: number) {
  return Number(value.toFixed(2));
}
