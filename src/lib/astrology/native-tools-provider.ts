import "server-only";

import { PLANETS, astrologyCalculationConfig } from "@/config/astrology";
import { computeAshtakoota } from "@/lib/astrology/engine/ashtakoota";
import { computeChart, computeChartForBirth } from "@/lib/astrology/engine/chart";
import { utcInstantOf } from "@/lib/astrology/engine/local-time";
import { PANCHANG_UNAVAILABLE_FIELDS, computePanchang } from "@/lib/astrology/engine/panchang";
import { NoSunCrossingError } from "@/lib/astrology/engine/sun-times";
import { AstrologyProviderError } from "@/lib/astrology/errors";
import type { AstrologyToolsProvider } from "@/lib/astrology/tools-provider";
import type {
  CompatibilityResult,
  KootaKey,
  KootaResult,
  KootaStatus,
  PanchangResult,
  TransitPlanetPosition,
  TransitResult,
} from "@/lib/astrology/tool-types";
import type { CalculationMetadata, NormalizedBirthDetails, ResolvedLocation } from "@/lib/kundli/types";

/**
 * The astrology tools, computed here rather than fetched.
 *
 * Transits and Panchang are the engine applied to a moment instead of a birth.
 * Compatibility is different in kind: it is a set of classical rules rather
 * than astronomy, and only the rules this engine has an unambiguous statement
 * of are scored. See the note at the top of ashtakoota.ts.
 */
export class NativeAstrologyToolsProvider implements AstrologyToolsProvider {
  readonly metadata: CalculationMetadata = {
    provider: "ravish-engine",
    providerVersion: "vsop87d+elp2000-82b",
    calculationVersion: astrologyCalculationConfig.version,
    ayanamsa: astrologyCalculationConfig.ayanamsa,
    houseSystem: astrologyCalculationConfig.houseSystem,
    calculatedAt: new Date().toISOString(),
    isDevelopmentFixture: false,
    limitations: [],
  };

  async calculateCompatibility(
    groom: NormalizedBirthDetails,
    bride: NormalizedBirthDetails,
  ): Promise<CompatibilityResult> {
    const moonOf = (input: NormalizedBirthDetails) => {
      const chart = computeChartForBirth(
        { dateOfBirth: input.dateOfBirth, timeOfBirth: input.timeOfBirth },
        {
          latitude: input.location.latitude,
          longitude: input.location.longitude,
          timezone: input.location.timezone,
        },
      );
      const moon = chart.planets.find((planet) => planet.planet === "Moon")!;
      const mars = chart.planets.find((planet) => planet.planet === "Mars")!;
      return { moonSign: moon.sign, moonNakshatra: moon.nakshatra, marsHouse: mars.house };
    };

    const groomChart = moonOf(groom);
    const brideChart = moonOf(bride);
    const result = computeAshtakoota(groomChart, brideChart);

    const kootas: KootaResult[] = result.kootas.map((koota) => ({
      key: koota.key as KootaKey,
      name: koota.name,
      score: koota.score,
      traditionalMaxScore: koota.maxScore,
      status: statusFor(koota.score, koota.maxScore),
      details: koota.details,
    }));

    const scored = kootas.filter((koota) => koota.score !== null);

    return {
      score: result.score,
      maxScore: result.traditionalMax,
      // Out of what was actually scored, not out of 36: dividing by a maximum
      // half the kootas did not contribute to would understate every match.
      percentage: result.availableMax > 0 ? (result.score / result.availableMax) * 100 : null,
      kootas,
      manglikComparison: manglikComparison(groomChart.marsHouse, brideChart.marsHouse),
      additionalFindings: [],
      summaryMetadata: {
        allKootaScoresProvided: scored.length === kootas.length,
        kootasWithScores: scored.length,
        kootaCount: kootas.length,
      },
      calculationMetadata: {
        ...this.metadata,
        calculatedAt: new Date().toISOString(),
        limitations: [
          `${kootas.length - scored.length} of the eight kootas are not calculated, and the score of ${result.score} is out of the ${result.availableMax} points those that are calculated can award - not out of 36.`,
        ],
      },
    };
  }

  async calculatePanchang(input: { date: string; location: ResolvedLocation }): Promise<PanchangResult> {
    const dayStart = utcInstantOf(input.date, "00:00", input.location.timezone);

    let panchang: ReturnType<typeof computePanchang>;
    try {
      panchang = computePanchang(dayStart, input.location.latitude, input.location.longitude);
    } catch (error) {
      if (error instanceof NoSunCrossingError) {
        throw new AstrologyProviderError({
          code: "UNAVAILABLE",
          provider: "ravish-engine",
          operation: "panchang",
          message: error.message,
          userMessage: `${error.message} A Panchang for this day cannot be calculated at this location.`,
        });
      }
      throw error;
    }

    const localTime = (at: Date) =>
      at.toLocaleTimeString("en-GB", {
        timeZone: input.location.timezone,
        hour: "2-digit",
        minute: "2-digit",
      });

    return {
      date: input.date,
      location: input.location,
      tithi: { name: panchang.tithi.name, paksha: panchang.tithi.paksha },
      nakshatra: { name: panchang.nakshatra.name, pada: panchang.nakshatra.pada },
      yoga: { name: panchang.yoga.name },
      karana: panchang.karana.name,
      vara: `${panchang.vara.english} (${panchang.vara.name})`,
      sunrise: localTime(panchang.sunrise),
      sunset: localTime(panchang.sunset),
      horaLord: panchang.horaLord,
      dishaShool: panchang.dishaShool,
      ayanamsaValue: formatAyanamsa(panchang.ayanamsa),
      unavailableFields: [...PANCHANG_UNAVAILABLE_FIELDS],
      calculationMetadata: { ...this.metadata, calculatedAt: new Date().toISOString() },
    };
  }

  async getTransitPlanet(planet: "Saturn", at: Date): Promise<TransitPlanetPosition> {
    const position = this.transitPositions(at).find((entry) => entry.planet === planet);
    if (!position) throw new Error(`${planet} is not a planet this engine calculates.`);
    return position;
  }

  async getAllTransits(at: Date): Promise<TransitResult> {
    return {
      at: at.toISOString(),
      positions: this.transitPositions(at),
      calculationMetadata: { ...this.metadata, calculatedAt: new Date().toISOString() },
    };
  }

  /**
   * Transiting positions need no birth place, but a chart does, so this asks
   * for one at Greenwich. Only the houses depend on the observer, and nothing
   * here reads them: planetary longitudes are the same everywhere on Earth.
   */
  private transitPositions(at: Date): TransitPlanetPosition[] {
    const chart = computeChart(at, { latitude: 0, longitude: 0, timezone: "UTC" });
    const order = new Map(PLANETS.map((planet, index) => [planet, index]));

    return chart.planets
      .slice()
      .sort((a, b) => (order.get(a.planet) ?? 0) - (order.get(b.planet) ?? 0))
      .map((planet) => ({
        planet: planet.planet,
        sign: planet.sign,
        degreeInSign: Math.round(planet.degreeInSign * 100) / 100,
        longitude: Math.round(planet.longitude * 100) / 100,
        nakshatra: planet.nakshatra,
        retrograde: planet.retrograde,
      }));
  }
}

function statusFor(score: number | null, maxScore: number): KootaStatus {
  if (score === null) return "unknown";
  if (score === 0) return "unfavourable";
  if (score >= maxScore) return "favourable";
  return "neutral";
}

/** Degrees as the degrees, minutes and seconds a Panchang prints. */
function formatAyanamsa(value: number): string {
  const degrees = Math.floor(value);
  const totalMinutes = (value - degrees) * 60;
  const minutes = Math.floor(totalMinutes);
  const seconds = Math.round((totalMinutes - minutes) * 60);
  return `${degrees}° ${String(minutes).padStart(2, "0")}' ${String(seconds).padStart(2, "0")}"`;
}

/**
 * Manglik comparison from the placement of Mars in each chart.
 *
 * The classical concern is a mismatch: one partner Manglik and the other not.
 * Exceptions and cancellations are not modelled, and the summary says so
 * rather than presenting this as a verdict.
 */
function manglikComparison(groomMarsHouse: number, brideMarsHouse: number): CompatibilityResult["manglikComparison"] {
  const houses = [1, 4, 7, 8, 12];
  const groom = houses.includes(groomMarsHouse);
  const bride = houses.includes(brideMarsHouse);

  if (groom === bride) {
    return {
      status: "favourable",
      summary: groom
        ? "Mars falls in a Manglik house in both charts, which the classical rule treats as balanced. Cancellations are not applied here."
        : "Mars falls in a Manglik house in neither chart.",
    };
  }

  return {
    status: "unfavourable",
    summary: `Mars falls in a Manglik house for the ${groom ? "groom" : "bride"} but not the other. Exceptions and cancellations that a practitioner would weigh are not applied here.`,
  };
}
