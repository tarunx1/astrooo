import type { NakshatraName, PlanetName, ZodiacSign } from "@/config/astrology";
import type { CalculationMetadata, ResolvedLocation } from "@/lib/kundli/types";

/**
 * Provider-neutral domain types for the Phase 6 tools.
 *
 * Nothing in this file mentions how a value is calculated, so a UI component
 * can never depend on the engine that produced it.
 */

/* ------------------------------------------------------------------ */
/* Compatibility                                                       */
/* ------------------------------------------------------------------ */

/** The eight classical kootas, in their traditional order. */
export const KOOTA_KEYS = [
  "varna",
  "vashya",
  "tara",
  "yoni",
  "grahaMaitri",
  "gana",
  "bhakoot",
  "nadi",
] as const;

export type KootaKey = (typeof KOOTA_KEYS)[number];

export type KootaStatus = "favourable" | "unfavourable" | "neutral" | "unknown";

/**
 * One koota.
 *
 * `score` is null whenever the calculation engine did not supply a number for
 * this koota. It is never estimated, and never back-filled to make the set add
 * up to a traditional total.
 */
export type KootaResult = {
  key: KootaKey;
  name: string;
  /** Numeric score, or null when the engine did not provide one. */
  score: number | null;
  /** Traditional maximum for this koota, shown for context only. */
  traditionalMaxScore: number;
  status: KootaStatus;
  /** Engine-provided explanation, if any. */
  details: string | null;
};

export type ManglikComparison = {
  status: "favourable" | "unfavourable" | "neutral" | "unknown";
  summary: string;
};

export type CompatibilityResult = {
  /** Aggregate score as reported by the calculation engine. */
  score: number | null;
  /** Traditional Ashtakoota maximum. */
  maxScore: number;
  percentage: number | null;
  kootas: KootaResult[];
  manglikComparison: ManglikComparison | null;
  /** Additional named findings the engine returned beyond the eight kootas. */
  additionalFindings: Array<{ name: string; status: KootaStatus; summary: string | null }>;
  summaryMetadata: {
    /** True when the engine supplied a numeric score for every koota. */
    allKootaScoresProvided: boolean;
    kootasWithScores: number;
    kootaCount: number;
  };
  calculationMetadata: CalculationMetadata;
};

/* ------------------------------------------------------------------ */
/* Panchang                                                            */
/* ------------------------------------------------------------------ */

/**
 * Panchang for one local calendar day at one place.
 *
 * Every field is optional because the engine does not supply all of them.
 * Absent values are omitted from the UI rather than shown as blank or guessed.
 */
export type PanchangResult = {
  /** Local calendar date the values describe, as YYYY-MM-DD. */
  date: string;
  location: ResolvedLocation;

  tithi?: { name: string; paksha: string; phase?: string };
  nakshatra?: { name: string; pada?: number };
  yoga?: { name: string; description?: string };
  karana?: string;
  vara?: string;
  lunarMonth?: string;

  /** Local wall-clock times, already converted to the location's timezone. */
  sunrise?: string;
  sunset?: string;

  horaLord?: string;
  dishaShool?: string;
  ayanamsaValue?: string;

  /**
   * Fields the traditional Panchang includes that this engine does not
   * calculate. Surfaced so the page can say so explicitly.
   */
  unavailableFields: string[];

  calculationMetadata: CalculationMetadata;
};

/* ------------------------------------------------------------------ */
/* Transits and Sade Sati                                              */
/* ------------------------------------------------------------------ */

export type TransitPlanetPosition = {
  /**
   * Named, not free text: transits are built by mapping over `PLANETS`, so the
   * value is always one of the nine. Typing it that way lets a transit position
   * feed the chart engine without a cast asserting something already true.
   */
  planet: PlanetName;
  sign: ZodiacSign;
  degreeInSign: number;
  longitude: number;
  nakshatra: NakshatraName;
  retrograde: boolean;
};

export type TransitResult = {
  /** Instant the positions describe, ISO 8601. */
  at: string;
  positions: TransitPlanetPosition[];
  calculationMetadata: CalculationMetadata;
};

export type SadeSatiPhase =
  | "not-active"
  | "first-phase"
  | "peak-phase"
  | "third-phase"
  | "ardha-kantaka"
  | "ashtama-shani";

export type SadeSatiResult = {
  phase: SadeSatiPhase;
  /** True only for the three genuine Sade Sati phases. */
  isSadeSati: boolean;
  moonSign: ZodiacSign;
  saturnSign: ZodiacSign;
  /** Saturn's position counted from the natal Moon sign, 1-12. */
  housesFromMoon: number;
  title: string;
  summary: string;
  /** The exact rule applied, shown to the reader. */
  ruleApplied: string;
  calculationMetadata: CalculationMetadata;
};
