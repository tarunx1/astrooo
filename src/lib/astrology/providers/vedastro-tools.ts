import type { PlanetName } from "@/config/astrology";
import { AstrologyProviderError } from "@/lib/astrology/errors";
import type {
  CompatibilityResult,
  KootaKey,
  KootaResult,
  KootaStatus,
  PanchangResult,
  TransitPlanetPosition,
} from "@/lib/astrology/tool-types";
import { KOOTA_KEYS } from "@/lib/astrology/tool-types";
import type { CalculationMetadata, ResolvedLocation } from "@/lib/kundli/types";
import { extractNamedRecords, normalizePlanet } from "@/lib/astrology/providers/vedastro-normalize";

/**
 * VedAstro response decoding for the Phase 6 tools.
 *
 * This is the only place VedAstro field names appear. Everything leaving these
 * functions is a provider-neutral domain type.
 */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function decodeFail(operation: string, message: string): AstrologyProviderError {
  return new AstrologyProviderError({
    code: "UNAVAILABLE",
    provider: "vedastro",
    operation,
    message,
    userMessage: "The astrology service returned an unexpected result. Please try again.",
  });
}

/* ------------------------------------------------------------------ */
/* Panchang                                                            */
/* ------------------------------------------------------------------ */

/** VedAstro StdTime is `HH:MM DD/MM/YYYY +HH:MM`; we keep the local wall clock. */
function parseStdTime(value: unknown): { time: string; date: string } | null {
  const raw = asString(asRecord(value)?.StdTime ?? value);
  if (!raw) return null;

  const match = raw.match(/^(\d{2}:\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;

  return { time: match[1], date: `${match[4]}-${match[3]}-${match[2]}` };
}

/** Nakshatra arrives as `"Swathi - 1"`; the pada is the trailing number. */
function parseNakshatra(value: unknown): { name: string; pada?: number } | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  const match = raw.match(/^(.+?)\s*-\s*(\d+)$/);
  if (match) return { name: match[1].trim(), pada: Number(match[2]) };
  return { name: raw };
}

/**
 * Fields a traditional Panchang carries that this engine does not calculate.
 * Listed so the page can say so rather than leaving silent gaps.
 */
export const PANCHANG_UNAVAILABLE_FIELDS = [
  "Moonrise and moonset",
  "Rahu Kaal",
  "Yamaganda",
  "Gulika Kaal",
  "Abhijit Muhurat",
];

export function normalizeVedAstroPanchang(input: {
  payload: unknown;
  requestedDate: string;
  location: ResolvedLocation;
  calculationMetadata: CalculationMetadata;
}): PanchangResult {
  const table = asRecord(asRecord(input.payload)?.PanchangaTable ?? input.payload);
  if (!table) throw decodeFail("PanchangaTable", "Panchang payload was not an object.");

  const sunrise = parseStdTime(table.Sunrise);
  const sunset = parseStdTime(table.Sunset);

  // Guard against the silent-default failure mode: a string time parameter makes
  // VedAstro answer Pass for 01/01/2000 at a placeholder location. If the echoed
  // day does not match what we asked for, the result is wrong and must not ship.
  if (sunrise && sunrise.date !== input.requestedDate) {
    throw decodeFail(
      "PanchangaTable",
      `Panchang echoed ${sunrise.date} but ${input.requestedDate} was requested; refusing a mismatched result.`,
    );
  }

  const echoedLocation = asRecord(asRecord(table.Sunrise)?.Location);
  const echoedLatitude = asNumber(echoedLocation?.Latitude);
  if (echoedLatitude !== undefined && Math.abs(echoedLatitude - input.location.latitude) > 0.5) {
    throw decodeFail(
      "PanchangaTable",
      "Panchang echoed a different location than requested; refusing a mismatched result.",
    );
  }

  const tithi = asRecord(table.Tithi);
  const yoga = asRecord(table.Yoga);

  return {
    date: input.requestedDate,
    location: input.location,
    tithi: tithi
      ? {
          name: asString(tithi.Name) ?? "Unknown",
          paksha: asString(tithi.Paksha) ?? "Unknown",
          phase: asString(tithi.Phase),
        }
      : undefined,
    nakshatra: parseNakshatra(table.Nakshatra),
    yoga: yoga ? { name: asString(yoga.Name) ?? "Unknown", description: asString(yoga.Description) } : undefined,
    karana: asString(table.Karana),
    vara: asString(table.Vara),
    lunarMonth: asString(table.LunarMonth),
    sunrise: sunrise?.time,
    sunset: sunset?.time,
    horaLord: asString(asRecord(table.HoraLord)?.Name),
    dishaShool: asString(table.DishaShool),
    ayanamsaValue: asString(table.Ayanamsa),
    unavailableFields: PANCHANG_UNAVAILABLE_FIELDS,
    calculationMetadata: input.calculationMetadata,
  };
}

/* ------------------------------------------------------------------ */
/* Compatibility                                                       */
/* ------------------------------------------------------------------ */

/** Traditional Ashtakoota weights, used for display context only. */
const KOOTA_DEFINITIONS: Record<KootaKey, { name: string; traditionalMaxScore: number; providerName: string }> = {
  varna: { name: "Varna", traditionalMaxScore: 1, providerName: "Varna" },
  vashya: { name: "Vashya", traditionalMaxScore: 2, providerName: "Vasya Kuta" },
  tara: { name: "Tara", traditionalMaxScore: 3, providerName: "Dina Kuta" },
  yoni: { name: "Yoni", traditionalMaxScore: 4, providerName: "Yoni Kuta" },
  grahaMaitri: { name: "Graha Maitri", traditionalMaxScore: 5, providerName: "Graha Maitram" },
  gana: { name: "Gana", traditionalMaxScore: 6, providerName: "Guna Kuta" },
  bhakoot: { name: "Bhakoot", traditionalMaxScore: 7, providerName: "Rasi Kuta" },
  nadi: { name: "Nadi", traditionalMaxScore: 8, providerName: "Nadi Kuta" },
};

export const ASHTAKOOTA_MAX_SCORE = 36;

function toStatus(nature: string | undefined): KootaStatus {
  switch (nature) {
    case "Good":
      return "favourable";
    case "Bad":
      return "unfavourable";
    case "Neutral":
      return "neutral";
    default:
      return "unknown";
  }
}

type Prediction = { Name?: unknown; Nature?: unknown; Score?: unknown; Info?: unknown };

export function normalizeVedAstroCompatibility(input: {
  payload: unknown;
  calculationMetadata: CalculationMetadata;
}): CompatibilityResult {
  const report = asRecord(asRecord(input.payload)?.MatchReport ?? input.payload);
  if (!report) throw decodeFail("MatchReport", "Match payload was not an object.");

  const predictions = Array.isArray(report.PredictionList) ? (report.PredictionList as Prediction[]) : [];
  const byName = new Map<string, Prediction>();
  for (const prediction of predictions) {
    const name = asString(prediction.Name);
    if (name && !byName.has(name)) byName.set(name, prediction);
  }

  const kootas: KootaResult[] = KOOTA_KEYS.map((key) => {
    const definition = KOOTA_DEFINITIONS[key];
    const prediction = byName.get(definition.providerName);

    return {
      key,
      name: definition.name,
      // Only a score the engine actually supplied. Never inferred from Nature,
      // never back-filled to make the eight reach 36.
      score: asNumber(prediction?.Score) ?? null,
      traditionalMaxScore: definition.traditionalMaxScore,
      status: toStatus(asString(prediction?.Nature)),
      details: asString(prediction?.Info) ?? null,
    };
  });

  const kuja = byName.get("Kuja Dosa");
  const score = asNumber(report.KutaScore) ?? null;
  const kootasWithScores = kootas.filter((koota) => koota.score !== null).length;

  // Named findings beyond the eight kootas that the engine actually returned.
  const classicalNames = new Set(Object.values(KOOTA_DEFINITIONS).map((definition) => definition.providerName));
  const additionalFindings = predictions
    .filter((prediction) => {
      const name = asString(prediction.Name);
      const nature = asString(prediction.Nature);
      return Boolean(name) && name !== "Empty" && nature !== "Empty" && !classicalNames.has(name!) && name !== "Kuja Dosa";
    })
    .slice(0, 12)
    .map((prediction) => ({
      name: asString(prediction.Name)!,
      status: toStatus(asString(prediction.Nature)),
      summary: asString(prediction.Info) ?? null,
    }));

  return {
    score,
    maxScore: ASHTAKOOTA_MAX_SCORE,
    percentage: score === null ? null : Math.round((Math.min(score, ASHTAKOOTA_MAX_SCORE) / ASHTAKOOTA_MAX_SCORE) * 100),
    kootas,
    manglikComparison: kuja
      ? { status: toStatus(asString(kuja.Nature)), summary: asString(kuja.Info) ?? "Kuja Dosa (Manglik) comparison." }
      : null,
    additionalFindings,
    summaryMetadata: {
      allKootaScoresProvided: kootasWithScores === KOOTA_KEYS.length,
      kootasWithScores,
      kootaCount: KOOTA_KEYS.length,
    },
    calculationMetadata: input.calculationMetadata,
  };
}

/* ------------------------------------------------------------------ */
/* Transits                                                            */
/* ------------------------------------------------------------------ */

/**
 * Decodes one planet's transit position.
 *
 * Delegates to the Kundli normalizer's verified planet decoder rather than
 * maintaining a second interpretation of VedAstro's planet payload. `house` is
 * meaningless without a natal chart, so only the zodiacal fields are surfaced.
 */
export function normalizeVedAstroTransitPlanet(payload: unknown, planet: PlanetName): TransitPlanetPosition | null {
  // Requesting all planets nests each under its own name; requesting a single
  // planet returns its fields flat at the root. Both shapes are handled, and the
  // flat root is used as the record when no named key is present.
  const records = extractNamedRecords(payload, [planet]);
  const unwrapped = asRecord(asRecord(payload)?.AllPlanetData ?? payload);
  const record = records[planet] ?? unwrapped;
  if (!record) return null;

  const position = normalizePlanet(planet, record, {});
  if (!position) return null;

  return {
    planet: position.planet,
    sign: position.sign,
    degreeInSign: position.degreeInSign,
    longitude: position.longitude,
    nakshatra: position.nakshatra,
    retrograde: position.retrograde,
  };
}
