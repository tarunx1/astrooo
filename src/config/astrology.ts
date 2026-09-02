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

export type AstrologyProviderName = "vedastro" | "development";

export const astrologyCalculationConfig = {
  version: "ravish-kundli-v1.1",
  ayanamsa: "LAHIRI",
  zodiac: "SIDEREAL",
  houseSystem: "VEDASTRO_DEFAULT",
} as const;

export const vedAstroConfig = {
  baseUrl: process.env.VEDASTRO_API_BASE_URL ?? "https://api.vedastro.org/api",
  apiKey: process.env.VEDASTRO_API_KEY,
  providerVersion: "vedastro-rest-v1",
  timeoutMs: Number(process.env.VEDASTRO_TIMEOUT_MS ?? 10000),
  retryCount: Number(process.env.VEDASTRO_RETRY_COUNT ?? 1),
} as const;

export function getConfiguredAstrologyProviderName(): AstrologyProviderName {
  const configured = process.env.ASTROLOGY_PROVIDER;
  if (configured === "vedastro" || configured === "development") return configured;
  if (process.env.NODE_ENV === "test") return "development";
  if (process.env.NODE_ENV === "production") {
    throw new Error("ASTROLOGY_PROVIDER=vedastro is required in production.");
  }
  return "development";
}
