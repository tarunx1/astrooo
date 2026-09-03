import { SIGNS, type ZodiacSign } from "@/config/astrology";
import type { TransitResult } from "@/lib/astrology/tool-types";

/**
 * Horoscope foundation.
 *
 * The separation this file exists to enforce: `DailyHoroscopeContext` is
 * deterministic transit data, and `HoroscopeEditorial` is human or
 * later-generated interpretation. They are different types on purpose, so
 * editorial copy can never be mistaken for a calculation.
 *
 * No daily horoscope publishing pipeline exists yet. Nothing in the product
 * claims one does.
 */
export type DailyHoroscopeContext = {
  /** Local calendar date the context describes. */
  date: string;
  sign: ZodiacSign;
  /** Deterministic transit positions, when a transit calculation is available. */
  transits: TransitResult | null;
};

export type HoroscopeEditorial = {
  sign: ZodiacSign;
  /** Who wrote it. Never implied to be a calculation. */
  source: "editorial" | "not-published";
  body: string | null;
  publishedAt: string | null;
};

/**
 * Static educational content about each sign.
 *
 * This is reference material about the sign itself, not a statement about any
 * individual and not a forecast. It is the same for every visitor.
 */
export type SignProfile = {
  sign: ZodiacSign;
  slug: string;
  sanskritName: string;
  rulingPlanet: string;
  element: "Fire" | "Earth" | "Air" | "Water";
  modality: "Movable" | "Fixed" | "Dual";
  symbol: string;
  /** Approximate sidereal dates. Sidereal signs do not align with Western dates. */
  siderealWindow: string;
  overview: string;
  traditionalTraits: string[];
};

export const SIGN_PROFILES: readonly SignProfile[] = [
  {
    sign: "Aries", slug: "aries", sanskritName: "Mesha", rulingPlanet: "Mars", element: "Fire", modality: "Movable",
    symbol: "The Ram", siderealWindow: "14 April – 14 May",
    overview: "Mesha is the first sign of the sidereal zodiac, ruled by Mars. Tradition associates it with initiative and directness.",
    traditionalTraits: ["Direct", "Energetic", "Impatient with delay", "Quick to begin"],
  },
  {
    sign: "Taurus", slug: "taurus", sanskritName: "Vrishabha", rulingPlanet: "Venus", element: "Earth", modality: "Fixed",
    symbol: "The Bull", siderealWindow: "15 May – 14 June",
    overview: "Vrishabha is ruled by Venus and is traditionally read as steady, resource-minded and slow to change course.",
    traditionalTraits: ["Steady", "Resourceful", "Comfort-seeking", "Slow to change"],
  },
  {
    sign: "Gemini", slug: "gemini", sanskritName: "Mithuna", rulingPlanet: "Mercury", element: "Air", modality: "Dual",
    symbol: "The Twins", siderealWindow: "15 June – 15 July",
    overview: "Mithuna is ruled by Mercury and is associated with communication, curiosity and a mind that moves quickly between subjects.",
    traditionalTraits: ["Curious", "Communicative", "Adaptable", "Easily distracted"],
  },
  {
    sign: "Cancer", slug: "cancer", sanskritName: "Karka", rulingPlanet: "Moon", element: "Water", modality: "Movable",
    symbol: "The Crab", siderealWindow: "16 July – 16 August",
    overview: "Karka is ruled by the Moon and is traditionally linked with home, memory and emotional attachment.",
    traditionalTraits: ["Protective", "Sentimental", "Home-centred", "Sensitive to mood"],
  },
  {
    sign: "Leo", slug: "leo", sanskritName: "Simha", rulingPlanet: "Sun", element: "Fire", modality: "Fixed",
    symbol: "The Lion", siderealWindow: "17 August – 16 September",
    overview: "Simha is ruled by the Sun and is associated with authority, visibility and a strong sense of self.",
    traditionalTraits: ["Confident", "Generous", "Proud", "Drawn to responsibility"],
  },
  {
    sign: "Virgo", slug: "virgo", sanskritName: "Kanya", rulingPlanet: "Mercury", element: "Earth", modality: "Dual",
    symbol: "The Maiden", siderealWindow: "17 September – 16 October",
    overview: "Kanya is ruled by Mercury and is traditionally read as analytical, precise and service-minded.",
    traditionalTraits: ["Analytical", "Precise", "Helpful", "Self-critical"],
  },
  {
    sign: "Libra", slug: "libra", sanskritName: "Tula", rulingPlanet: "Venus", element: "Air", modality: "Movable",
    symbol: "The Scales", siderealWindow: "17 October – 15 November",
    overview: "Tula is ruled by Venus and is associated with balance, partnership and negotiation.",
    traditionalTraits: ["Diplomatic", "Partnership-minded", "Aesthetic", "Reluctant to decide alone"],
  },
  {
    sign: "Scorpio", slug: "scorpio", sanskritName: "Vrishchika", rulingPlanet: "Mars", element: "Water", modality: "Fixed",
    symbol: "The Scorpion", siderealWindow: "16 November – 15 December",
    overview: "Vrishchika is ruled by Mars and is traditionally linked with depth, research and private intensity.",
    traditionalTraits: ["Intense", "Private", "Investigative", "Slow to trust"],
  },
  {
    sign: "Sagittarius", slug: "sagittarius", sanskritName: "Dhanu", rulingPlanet: "Jupiter", element: "Fire", modality: "Dual",
    symbol: "The Archer", siderealWindow: "16 December – 13 January",
    overview: "Dhanu is ruled by Jupiter and is associated with teaching, travel and questions of meaning.",
    traditionalTraits: ["Optimistic", "Philosophical", "Straight-talking", "Restless"],
  },
  {
    sign: "Capricorn", slug: "capricorn", sanskritName: "Makara", rulingPlanet: "Saturn", element: "Earth", modality: "Movable",
    symbol: "The Crocodile", siderealWindow: "14 January – 12 February",
    overview: "Makara is ruled by Saturn and is traditionally read as disciplined, patient and long-term in outlook.",
    traditionalTraits: ["Disciplined", "Patient", "Ambitious", "Reserved"],
  },
  {
    sign: "Aquarius", slug: "aquarius", sanskritName: "Kumbha", rulingPlanet: "Saturn", element: "Air", modality: "Fixed",
    symbol: "The Water Bearer", siderealWindow: "13 February – 12 March",
    overview: "Kumbha is ruled by Saturn and is associated with community, systems and an independent turn of mind.",
    traditionalTraits: ["Independent", "Community-minded", "Unconventional", "Detached"],
  },
  {
    sign: "Pisces", slug: "pisces", sanskritName: "Meena", rulingPlanet: "Jupiter", element: "Water", modality: "Dual",
    symbol: "The Fishes", siderealWindow: "13 March – 13 April",
    overview: "Meena is ruled by Jupiter and is traditionally linked with imagination, compassion and inner life.",
    traditionalTraits: ["Compassionate", "Imaginative", "Adaptable", "Easily overwhelmed"],
  },
] as const;

export function getSignProfile(slug: string): SignProfile | null {
  return SIGN_PROFILES.find((profile) => profile.slug === slug) ?? null;
}

export function isZodiacSign(value: string): value is ZodiacSign {
  return (SIGNS as readonly string[]).includes(value);
}
