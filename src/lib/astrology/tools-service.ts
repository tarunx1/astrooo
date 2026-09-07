import "server-only";

import { createHash } from "node:crypto";
import { astrologyCalculationConfig } from "@/config/astrology";
import { isAstrologyProviderError } from "@/lib/astrology/errors";
import { getAstrologyToolsProvider } from "@/lib/astrology/tools-provider";
import { classifySadeSati } from "@/lib/astrology/sade-sati";
import type {
  CompatibilityResult,
  PanchangResult,
  SadeSatiResult,
  TransitPlanetPosition,
  TransitResult,
} from "@/lib/astrology/tool-types";
import { getAstrologyProvider } from "@/lib/astrology/provider";
import { createKundliInputHash } from "@/lib/kundli/normalize";
import { findKundliByHash, persistKundliCalculation } from "@/lib/kundli/store";
import type { KundliResult, NormalizedBirthDetails, ResolvedLocation } from "@/lib/kundli/types";

/**
 * Tool services.
 *
 * Two rules drive the caching here. Calculation is now local and cheap, so the
 * point is no longer a provider quota but a stable, shareable answer: the
 * only 5 requests a minute:
 *
 * 1. Birth-based calculators (Moon sign, Nakshatra, Lagna, Sade Sati) never call
 *    the provider for data the cached Kundli already contains. One Kundli
 *    calculation answers all of them.
 * 2. Panchang and Saturn transits are cached on a deterministic key so repeat
 *    views cost nothing.
 */
export type ToolOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

function toFailure(error: unknown, fallback: string): { ok: false; message: string } {
  if (isAstrologyProviderError(error)) return { ok: false, message: error.userMessage };
  return { ok: false, message: fallback };
}

/* ------------------------------------------------------------------ */
/* Shared in-process cache                                             */
/* ------------------------------------------------------------------ */

type CacheEntry<T> = { value: T; expiresAt: number };

const globalForTools = globalThis as typeof globalThis & {
  ravishToolCache?: Map<string, CacheEntry<unknown>>;
};

const cache: Map<string, CacheEntry<unknown>> =
  globalForTools.ravishToolCache ?? (globalForTools.ravishToolCache = new Map());

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/* ------------------------------------------------------------------ */
/* Birth-based calculators                                             */
/* ------------------------------------------------------------------ */

/**
 * Resolves the Kundli for these birth details, reusing the deterministic cache.
 *
 * This is the single entry point every birth-based calculator uses, so a Moon
 * sign lookup costs zero provider calls whenever the chart has been calculated
 * before with the same inputs and configuration.
 */
export async function resolveKundliForTools(
  input: NormalizedBirthDetails,
): Promise<{ result: KundliResult; calculationId: string; fromCache: boolean }> {
  const inputHash = createKundliInputHash(input);
  const existing = await findKundliByHash(inputHash);

  if (existing) {
    console.info("astrology_tool_calculation", { operation: "kundli", cache: "hit", success: true });
    return { result: existing.result, calculationId: existing.id, fromCache: true };
  }

  const result = await getAstrologyProvider().calculateKundli(input);
  const stored = await persistKundliCalculation({ input, result });

  console.info("astrology_tool_calculation", { operation: "kundli", cache: "miss", success: true });
  return { result: stored.result, calculationId: stored.id, fromCache: false };
}

export type BirthInsight = {
  calculationId: string;
  fromCache: boolean;
  moonSign: KundliResult["moonSign"];
  sunSign: KundliResult["sunSign"];
  nakshatra: KundliResult["nakshatra"];
  ascendant: KundliResult["ascendant"];
  moonPosition: KundliResult["planets"][number] | null;
  houses: KundliResult["houses"];
  calculationMetadata: KundliResult["calculationMetadata"];
};

/** One cached Kundli answers Moon sign, Nakshatra and Lagna together. */
export async function getBirthInsight(input: NormalizedBirthDetails): Promise<ToolOutcome<BirthInsight>> {
  try {
    const { result, calculationId, fromCache } = await resolveKundliForTools(input);

    return {
      ok: true,
      value: {
        calculationId,
        fromCache,
        moonSign: result.moonSign,
        sunSign: result.sunSign,
        nakshatra: result.nakshatra,
        ascendant: result.ascendant,
        moonPosition: result.planets.find((planet) => planet.planet === "Moon") ?? null,
        houses: result.houses,
        calculationMetadata: result.calculationMetadata,
      },
    };
  } catch (error) {
    return toFailure(error, "The astrology calculation service is temporarily unavailable. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/* Sade Sati                                                           */
/* ------------------------------------------------------------------ */

/** Saturn changes sign roughly every 2.5 years, so one lookup per UTC day is ample. */
const SATURN_TRANSIT_TTL_MS = 6 * 60 * 60 * 1000;

export async function getSaturnTransit(at: Date = new Date()): Promise<TransitPlanetPosition> {
  const key = `saturn:${at.toISOString().slice(0, 10)}:${astrologyCalculationConfig.version}`;
  return cached(key, SATURN_TRANSIT_TTL_MS, () => getAstrologyToolsProvider().getTransitPlanet("Saturn", at));
}

export async function getSadeSati(input: NormalizedBirthDetails): Promise<ToolOutcome<SadeSatiResult>> {
  try {
    const [insight, saturn] = await Promise.all([resolveKundliForTools(input), getSaturnTransit()]);

    return {
      ok: true,
      value: classifySadeSati({
        moonSign: insight.result.moonSign,
        saturnSign: saturn.sign,
        calculationMetadata: insight.result.calculationMetadata,
      }),
    };
  } catch (error) {
    return toFailure(error, "The Sade Sati calculation is temporarily unavailable. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/* Panchang                                                            */
/* ------------------------------------------------------------------ */

const PANCHANG_TTL_MS = 12 * 60 * 60 * 1000;

/** Deterministic key: same day, place and configuration means the same answer. */
export function panchangCacheKey(date: string, location: ResolvedLocation): string {
  const payload = JSON.stringify({
    date,
    latitude: Number(location.latitude.toFixed(4)),
    longitude: Number(location.longitude.toFixed(4)),
    timezone: location.timezone,
    ayanamsa: astrologyCalculationConfig.ayanamsa,
    calculationVersion: astrologyCalculationConfig.version,
  });

  return `panchang:${createHash("sha256").update(payload).digest("hex").slice(0, 32)}`;
}

export async function getPanchang(input: {
  date: string;
  location: ResolvedLocation;
}): Promise<ToolOutcome<PanchangResult>> {
  try {
    const value = await cached(panchangCacheKey(input.date, input.location), PANCHANG_TTL_MS, () =>
      getAstrologyToolsProvider().calculatePanchang(input),
    );

    return { ok: true, value };
  } catch (error) {
    return toFailure(error, "The Panchang service is temporarily unavailable. Please try again.");
  }
}

/* ------------------------------------------------------------------ */
/* Compatibility                                                       */
/* ------------------------------------------------------------------ */

export async function getCompatibility(
  a: NormalizedBirthDetails,
  b: NormalizedBirthDetails,
): Promise<ToolOutcome<CompatibilityResult>> {
  try {
    return { ok: true, value: await getAstrologyToolsProvider().calculateCompatibility(a, b) };
  } catch (error) {
    return toFailure(error, "The compatibility service is temporarily unavailable. Please try again.");
  }
}

/**
 * Current planetary transits.
 *
 * Anchored to the top of the current UTC hour so the answer is stable and
 * shareable rather than changing on every reload, and cached for that hour so a
 * busy page costs one provider call rather than one per visitor.
 */
const TRANSIT_SNAPSHOT_TTL_MS = 60 * 60 * 1000;

export function currentTransitAnchor(now: Date = new Date()): Date {
  const anchored = new Date(now);
  anchored.setUTCMinutes(0, 0, 0);
  return anchored;
}

export async function getCurrentTransits(now: Date = new Date()): Promise<ToolOutcome<TransitResult>> {
  const anchor = currentTransitAnchor(now);
  const key = `transits:${anchor.toISOString()}:${astrologyCalculationConfig.version}`;

  try {
    const value = await cached(key, TRANSIT_SNAPSHOT_TTL_MS, () => getAstrologyToolsProvider().getAllTransits(anchor));
    return { ok: true, value };
  } catch (error) {
    return toFailure(error, "The transit calculation is temporarily unavailable. Please try again.");
  }
}
