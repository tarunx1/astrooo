import "server-only";

import { astrologyCalculationConfig, getConfiguredAstrologyProviderName, vedAstroConfig } from "@/config/astrology";
import { AstrologyProviderError } from "@/lib/astrology/errors";
import { VedAstroClient } from "@/lib/astrology/providers/vedastro-client";
import {
  normalizeVedAstroCompatibility,
  normalizeVedAstroPanchang,
  normalizeVedAstroTransitPlanet,
} from "@/lib/astrology/providers/vedastro-tools";
import { getHistoricalUtcOffset, toVedAstroLocation } from "@/lib/astrology/providers/vedastro-time";
import type { CompatibilityResult, PanchangResult, TransitPlanetPosition } from "@/lib/astrology/tool-types";
import type { CalculationMetadata, NormalizedBirthDetails, ResolvedLocation } from "@/lib/kundli/types";

/**
 * Provider surface for the Phase 6 tools.
 *
 * Kept separate from the Kundli `AstrologyProvider` so the existing contract is
 * untouched. Every method returns a provider-neutral domain type; no VedAstro
 * field name escapes the adapter.
 */
export interface AstrologyToolsProvider {
  readonly metadata: CalculationMetadata;
  calculateCompatibility(a: NormalizedBirthDetails, b: NormalizedBirthDetails): Promise<CompatibilityResult>;
  calculatePanchang(input: { date: string; location: ResolvedLocation }): Promise<PanchangResult>;
  getTransitPlanet(planet: "Saturn", at: Date): Promise<TransitPlanetPosition>;
}

function metadataFor(provider: string, providerVersion: string, isFixture: boolean): CalculationMetadata {
  return {
    provider,
    providerVersion,
    calculationVersion: astrologyCalculationConfig.version,
    ayanamsa: astrologyCalculationConfig.ayanamsa,
    houseSystem: astrologyCalculationConfig.houseSystem,
    calculatedAt: new Date().toISOString(),
    isDevelopmentFixture: isFixture,
    limitations: [],
  };
}

/** Builds the object-form time VedAstro requires. A string is silently defaulted. */
function toVedAstroBirthTime(input: NormalizedBirthDetails) {
  const [year, month, day] = input.dateOfBirth.split("-");
  return {
    StdTime: `${input.timeOfBirth} ${day}/${month}/${year} ${getHistoricalUtcOffset(input.dateOfBirth, input.timeOfBirth, input.location.timezone)}`,
    Location: toVedAstroLocation(input),
  };
}

/**
 * Panchang is anchored at local noon.
 *
 * Using noon in the location's own timezone guarantees the instant falls inside
 * the requested local calendar day regardless of UTC offset or DST, which is
 * what "the Panchang for 3 September in Amritsar" has to mean.
 */
function toLocalNoonTime(date: string, location: ResolvedLocation) {
  const [year, month, day] = date.split("-");
  return {
    StdTime: `12:00 ${day}/${month}/${year} ${getHistoricalUtcOffset(date, "12:00", location.timezone)}`,
    Location: { Name: location.displayName, Longitude: location.longitude, Latitude: location.latitude },
  };
}

function toInstantTime(at: Date, location: ResolvedLocation) {
  const iso = at.toISOString().slice(0, 10);
  const time = at.toISOString().slice(11, 16);
  const [year, month, day] = iso.split("-");
  return {
    StdTime: `${time} ${day}/${month}/${year} +00:00`,
    Location: { Name: location.displayName, Longitude: location.longitude, Latitude: location.latitude },
  };
}

/** Reference point for a transit position; Saturn's sign does not depend on it. */
const TRANSIT_REFERENCE_LOCATION: ResolvedLocation = {
  placeId: "reference:greenwich",
  displayName: "Greenwich",
  city: "Greenwich",
  country: "United Kingdom",
  latitude: 51.4779,
  longitude: 0,
  timezone: "UTC",
};

export class VedAstroToolsProvider implements AstrologyToolsProvider {
  private readonly client: VedAstroClient;

  readonly metadata = metadataFor("vedastro", vedAstroConfig.providerVersion, false);

  constructor(client = new VedAstroClient()) {
    this.client = client;
  }

  async calculateCompatibility(a: NormalizedBirthDetails, b: NormalizedBirthDetails): Promise<CompatibilityResult> {
    const payload = await this.client.calculate("MatchReport", {
      maleBirthTime: toVedAstroBirthTime(a),
      femaleBirthTime: toVedAstroBirthTime(b),
      Ayanamsa: astrologyCalculationConfig.ayanamsa,
    });

    return normalizeVedAstroCompatibility({ payload, calculationMetadata: this.metadata });
  }

  async calculatePanchang(input: { date: string; location: ResolvedLocation }): Promise<PanchangResult> {
    const payload = await this.client.calculate("PanchangaTable", {
      inputTime: toLocalNoonTime(input.date, input.location),
      Ayanamsa: astrologyCalculationConfig.ayanamsa,
    });

    return normalizeVedAstroPanchang({
      payload,
      requestedDate: input.date,
      location: input.location,
      calculationMetadata: this.metadata,
    });
  }

  async getTransitPlanet(planet: "Saturn", at: Date): Promise<TransitPlanetPosition> {
    const payload = await this.client.calculate("AllPlanetData", {
      Time: toInstantTime(at, TRANSIT_REFERENCE_LOCATION),
      PlanetName: planet,
      Ayanamsa: astrologyCalculationConfig.ayanamsa,
    });

    const position = normalizeVedAstroTransitPlanet(payload, planet);
    if (!position) {
      throw new AstrologyProviderError({
        code: "UNAVAILABLE",
        provider: "vedastro",
        operation: "AllPlanetData",
        message: `Could not decode a transit position for ${planet}.`,
        userMessage: "The transit calculation is temporarily unavailable. Please try again.",
      });
    }

    return position;
  }
}

export function getAstrologyToolsProvider(): AstrologyToolsProvider {
  const configured = getConfiguredAstrologyProviderName();
  if (configured === "vedastro") return new VedAstroToolsProvider();

  if (process.env.NODE_ENV === "production") {
    throw new AstrologyProviderError({
      code: "CONFIGURATION",
      provider: "development",
      message: "Development astrology provider is disabled in production.",
      userMessage: "This astrology calculation is not configured.",
    });
  }

  // Development uses the same VedAstro adapter: these tools have no fixture
  // implementation, and inventing one risks fixture data reaching a user.
  return new VedAstroToolsProvider();
}
