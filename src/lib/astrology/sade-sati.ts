import { SIGNS, type ZodiacSign } from "@/config/astrology";
import type { SadeSatiPhase, SadeSatiResult } from "@/lib/astrology/tool-types";
import type { CalculationMetadata } from "@/lib/kundli/types";

/**
 * Sade Sati classification.
 *
 * The engine has no dedicated Sade Sati routine, so this is a documented deterministic
 * rule over two provider-supplied positions: the natal Moon sign and Saturn's
 * current sidereal sign. The astronomy is entirely the provider's; only the
 * classification below is ours, and the page states the rule it applied.
 *
 * Counting is inclusive from the Moon sign, the standard convention: Saturn in
 * the same sign as the Moon is the 1st, the next sign is the 2nd, and so on.
 */
export const SADE_SATI_RULE =
  "Saturn in the 12th, 1st or 2nd sign from the natal Moon sign marks the three phases of Sade Sati. " +
  "Saturn in the 4th is Ardha Kantaka and in the 8th is Ashtama Shani. Signs are counted inclusively from the Moon.";

/** Inclusive count from `from` to `to`, 1-12. */
export function signsFrom(from: ZodiacSign, to: ZodiacSign): number {
  const fromIndex = SIGNS.indexOf(from);
  const toIndex = SIGNS.indexOf(to);
  if (fromIndex < 0 || toIndex < 0) throw new Error("Unknown zodiac sign supplied to signsFrom.");

  return ((toIndex - fromIndex + 12) % 12) + 1;
}

const PHASE_COPY: Record<SadeSatiPhase, { title: string; summary: string }> = {
  "first-phase": {
    title: "Sade Sati — first phase",
    summary:
      "Saturn is transiting the twelfth sign from your Moon. Tradition reads this opening phase as a period of endings, expense and inward change rather than outward crisis.",
  },
  "peak-phase": {
    title: "Sade Sati — second (peak) phase",
    summary:
      "Saturn is transiting your Moon sign. This is traditionally the most demanding stretch of the cycle, associated with responsibility, tiredness and a slower pace.",
  },
  "third-phase": {
    title: "Sade Sati — third phase",
    summary:
      "Saturn is transiting the second sign from your Moon. Tradition reads the closing phase as consolidation, with pressure easing towards the end.",
  },
  "ardha-kantaka": {
    title: "Ardha Kantaka (small panoti)",
    summary:
      "Saturn is transiting the fourth sign from your Moon. This is not Sade Sati, but tradition treats it as a lesser Saturn period affecting home and peace of mind.",
  },
  "ashtama-shani": {
    title: "Ashtama Shani",
    summary:
      "Saturn is transiting the eighth sign from your Moon. This is not Sade Sati, but tradition treats it as a demanding Saturn period.",
  },
  "not-active": {
    title: "Sade Sati is not active",
    summary:
      "Saturn is not currently transiting the twelfth, first or second sign from your Moon, so you are not in Sade Sati.",
  },
};

export function classifySadeSati(input: {
  moonSign: ZodiacSign;
  saturnSign: ZodiacSign;
  calculationMetadata: CalculationMetadata;
}): SadeSatiResult {
  const housesFromMoon = signsFrom(input.moonSign, input.saturnSign);

  const phase: SadeSatiPhase =
    housesFromMoon === 12
      ? "first-phase"
      : housesFromMoon === 1
        ? "peak-phase"
        : housesFromMoon === 2
          ? "third-phase"
          : housesFromMoon === 4
            ? "ardha-kantaka"
            : housesFromMoon === 8
              ? "ashtama-shani"
              : "not-active";

  const copy = PHASE_COPY[phase];

  return {
    phase,
    isSadeSati: phase === "first-phase" || phase === "peak-phase" || phase === "third-phase",
    moonSign: input.moonSign,
    saturnSign: input.saturnSign,
    housesFromMoon,
    title: copy.title,
    summary: copy.summary,
    ruleApplied: SADE_SATI_RULE,
    calculationMetadata: input.calculationMetadata,
  };
}
