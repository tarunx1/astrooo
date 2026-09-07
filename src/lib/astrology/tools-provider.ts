import "server-only";

import { NativeAstrologyToolsProvider } from "@/lib/astrology/native-tools-provider";
import type { CompatibilityResult, PanchangResult, TransitPlanetPosition, TransitResult } from "@/lib/astrology/tool-types";
import type { CalculationMetadata, NormalizedBirthDetails, ResolvedLocation } from "@/lib/kundli/types";

/**
 * Provider surface for the astrology tools.
 *
 * Kept separate from the Kundli `AstrologyProvider` because these answer
 * questions about a moment and a place rather than about a birth. Every method
 * returns a domain type, so no calculation detail reaches a component.
 *
 * The interface survives the move to our own engine even though there is now
 * only one implementation, because it is what keeps the tools from reaching
 * into the ephemeris directly.
 */
export interface AstrologyToolsProvider {
  readonly metadata: CalculationMetadata;
  calculateCompatibility(a: NormalizedBirthDetails, b: NormalizedBirthDetails): Promise<CompatibilityResult>;
  calculatePanchang(input: { date: string; location: ResolvedLocation }): Promise<PanchangResult>;
  getTransitPlanet(planet: "Saturn", at: Date): Promise<TransitPlanetPosition>;
  getAllTransits(at: Date): Promise<TransitResult>;
}

export function getAstrologyToolsProvider(): AstrologyToolsProvider {
  return new NativeAstrologyToolsProvider();
}
