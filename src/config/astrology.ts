export const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"] as const;

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

export type PlanetName = (typeof PLANETS)[number];
export type ZodiacSign = (typeof SIGNS)[number];
export type NakshatraName = (typeof NAKSHATRAS)[number];

export type AstrologyProviderName = "native" | "vedastro" | "development";

export const astrologyCalculationConfig = {
  // Bumped when a change would move a placement: charts stored under an older
  // version were calculated differently and must not be compared to new ones.
  version: "ravish-kundli-v2.0",
  ayanamsa: "LAHIRI",
  zodiac: "SIDEREAL",
  houseSystem: "WHOLE_SIGN",
} as const;

export const vedAstroConfig = {
  baseUrl: process.env.VEDASTRO_API_BASE_URL ?? "https://api.vedastro.org/api",
  apiKey: process.env.VEDASTRO_API_KEY,
  providerVersion: "vedastro-rest-v1",
  timeoutMs: Number(process.env.VEDASTRO_TIMEOUT_MS ?? 10000),
  retryCount: Number(process.env.VEDASTRO_RETRY_COUNT ?? 1),
} as const;

/**
 * Which engine calculates a chart.
 *
 * "native" is this repository's own ephemeris and needs no configuration, no
 * key and no network, so it is the default in every environment including
 * production. The development fixture stays reachable by explicit opt-in for
 * tests that want a chart without computing one.
 */
export function getConfiguredAstrologyProviderName(): AstrologyProviderName {
  const configured = process.env.ASTROLOGY_PROVIDER;
  if (configured === "native" || configured === "development") return configured;
  return "native";
}
