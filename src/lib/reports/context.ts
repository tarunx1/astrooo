import type { KundliResult } from "@/lib/kundli/types";
import type { CalculatedFact } from "@/lib/reports/document";

/**
 * Report context builder.
 *
 * The pipeline is strictly:
 *
 *   BirthProfile -> immutable AstrologyCalculation -> normalized KundliResult
 *   -> ReportContextBuilder -> LLM -> structured interpretation
 *
 * The model receives astrology that has *already been calculated*. It is never
 * asked to compute a position, a dasha or a timing, and it never sees raw birth
 * details beyond the subject's name. Everything here is a projection of an
 * existing KundliResult.
 */
export type ReportContext = {
  subjectName: string;
  ascendant: string;
  ascendantDegree: number;
  sunSign: string;
  moonSign: string;
  nakshatra: string;
  nakshatraPada: number;
  currentMahadasha: string;
  currentAntardasha: string;
  dashaBalance: string;
  manglikStatus: string;
  manglikSummary: string;
  planets: Array<{
    planet: string;
    sign: string;
    house: number;
    degreeInSign: number;
    nakshatra: string;
    retrograde: boolean;
  }>;
  houses: Array<{ house: number; sign: string; planets: string[] }>;
  yogas: Array<{ name: string; summary: string }>;
  calculationVersion: string;
  ayanamsa: string;
  houseSystem: string;
  isDevelopmentFixture: boolean;
};

export function buildReportContext(result: KundliResult): ReportContext {
  return {
    subjectName: result.person.name,
    ascendant: result.ascendant.sign,
    ascendantDegree: Number(result.ascendant.degree.toFixed(2)),
    sunSign: result.sunSign,
    moonSign: result.moonSign,
    nakshatra: result.nakshatra.name,
    nakshatraPada: result.nakshatra.pada,
    currentMahadasha: result.vimshottariDasha.currentMahadasha,
    currentAntardasha: result.vimshottariDasha.currentAntardasha,
    dashaBalance: result.vimshottariDasha.balance,
    manglikStatus: result.manglik.status,
    manglikSummary: result.manglik.summary,
    planets: result.planets.map((planet) => ({
      planet: planet.planet,
      sign: planet.sign,
      house: planet.house,
      degreeInSign: Number(planet.degreeInSign.toFixed(2)),
      nakshatra: planet.nakshatra,
      retrograde: planet.retrograde,
    })),
    houses: result.houses.map((house) => ({
      house: house.house,
      sign: house.sign,
      planets: [...house.planets],
    })),
    yogas: result.yogas.map((yoga) => ({ name: yoga.name, summary: yoga.summary })),
    calculationVersion: result.calculationMetadata.calculationVersion,
    ayanamsa: result.calculationMetadata.ayanamsa,
    houseSystem: result.calculationMetadata.houseSystem,
    isDevelopmentFixture: result.calculationMetadata.isDevelopmentFixture,
  };
}

/**
 * The deterministic values reproduced verbatim in the finished report.
 *
 * These are lifted straight from the calculation so the printed facts cannot
 * drift from what was actually computed, whatever the model writes around them.
 */
export function buildCalculatedFacts(context: ReportContext): CalculatedFact[] {
  const facts: CalculatedFact[] = [
    { label: "Ascendant (Lagna)", value: `${context.ascendant} ${context.ascendantDegree}°` },
    { label: "Moon Sign (Rashi)", value: context.moonSign },
    { label: "Sun Sign", value: context.sunSign },
    { label: "Nakshatra", value: `${context.nakshatra} (Pada ${context.nakshatraPada})` },
    { label: "Current Mahadasha", value: context.currentMahadasha },
    { label: "Current Antardasha", value: context.currentAntardasha },
    { label: "Dasha Balance at Birth", value: context.dashaBalance },
    { label: "Manglik Status", value: context.manglikStatus },
    { label: "Ayanamsa", value: context.ayanamsa },
    { label: "House System", value: context.houseSystem },
  ];

  for (const planet of context.planets) {
    facts.push({
      label: planet.planet,
      value: `${planet.sign} ${planet.degreeInSign}° · House ${planet.house} · ${planet.nakshatra}${
        planet.retrograde ? " · Retrograde" : ""
      }`,
    });
  }

  return facts.slice(0, 40);
}

/** Compact, token-efficient rendering of the chart for the prompt. */
export function serializeContextForPrompt(context: ReportContext): string {
  const planets = context.planets
    .map(
      (planet) =>
        `${planet.planet}: ${planet.sign} ${planet.degreeInSign}deg, house ${planet.house}, nakshatra ${planet.nakshatra}${
          planet.retrograde ? ", retrograde" : ""
        }`,
    )
    .join("\n");

  const houses = context.houses
    .map((house) => `House ${house.house}: ${house.sign}${house.planets.length ? ` (${house.planets.join(", ")})` : ""}`)
    .join("\n");

  const yogas = context.yogas.length
    ? context.yogas.map((yoga) => `${yoga.name}: ${yoga.summary}`).join("\n")
    : "None recorded.";

  return [
    `Ascendant: ${context.ascendant} ${context.ascendantDegree}deg`,
    `Moon sign: ${context.moonSign}`,
    `Sun sign: ${context.sunSign}`,
    `Nakshatra: ${context.nakshatra}, pada ${context.nakshatraPada}`,
    `Current Mahadasha: ${context.currentMahadasha}`,
    `Current Antardasha: ${context.currentAntardasha}`,
    `Dasha balance at birth: ${context.dashaBalance}`,
    `Manglik: ${context.manglikStatus} (${context.manglikSummary})`,
    "",
    "PLANETARY POSITIONS (calculated, authoritative):",
    planets,
    "",
    "HOUSES:",
    houses,
    "",
    "YOGAS:",
    yogas,
  ].join("\n");
}
