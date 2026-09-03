import {
  CHALDEAN_LETTER_VALUES,
  VOWELS,
  chaldeanSum,
  digitSum,
  isMasterNumber,
  normalizeNameForNumerology,
  reduceKeepingMasters,
  reduceToSingleDigit,
  rulerFor,
} from "@/lib/numerology/rules";
import type { NumerologyInput, NumerologyNumber, NumerologyResult } from "@/lib/numerology/types";

/**
 * Deterministic numerology calculator.
 *
 * Pure arithmetic with no I/O and no model involvement. The same input always
 * produces the same output, and every number carries the working that produced
 * it so the page can show its derivation.
 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class NumerologyCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NumerologyCalculationError";
  }
}

/** Validates a real calendar date, rejecting things like 2026-02-30. */
function parseDate(dateOfBirth: string): { year: number; month: number; day: number } {
  if (!DATE_PATTERN.test(dateOfBirth)) {
    throw new NumerologyCalculationError("Date of birth must be in YYYY-MM-DD format.");
  }

  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));

  if (
    asDate.getUTCFullYear() !== year ||
    asDate.getUTCMonth() + 1 !== month ||
    asDate.getUTCDate() !== day
  ) {
    throw new NumerologyCalculationError("Enter a real calendar date.");
  }

  return { year, month, day };
}

/**
 * Life Path.
 *
 * Each component (day, month, year) is reduced first, then the three are summed
 * and reduced. Reducing components before summing is the standard method and
 * preserves master numbers that a straight digit sum would destroy.
 */
export function calculateLifePath(dateOfBirth: string): NumerologyNumber {
  const { year, month, day } = parseDate(dateOfBirth);

  const dayReduced = reduceKeepingMasters(day);
  const monthReduced = reduceKeepingMasters(month);
  const yearReduced = reduceKeepingMasters(digitSum(year));

  const total = dayReduced + monthReduced + yearReduced;
  const value = reduceKeepingMasters(total);

  return {
    key: "lifePath",
    label: "Life Path Number",
    value,
    isMasterNumber: isMasterNumber(value),
    ruler: rulerFor(value),
    workings: `day ${day} → ${dayReduced}, month ${month} → ${monthReduced}, year ${year} → ${yearReduced}; ${dayReduced}+${monthReduced}+${yearReduced} = ${total} → ${value}`,
  };
}

/**
 * Birth Number (Mulank): the day of the month reduced to a single digit.
 *
 * Master numbers are **not** preserved here — traditional Indian practice reads
 * the Mulank as 1-9, so the 29th is 2, not 11.
 */
export function calculateBirthNumber(dateOfBirth: string): NumerologyNumber {
  const { day } = parseDate(dateOfBirth);
  const value = reduceToSingleDigit(day);

  return {
    key: "birthNumber",
    label: "Birth Number (Mulank)",
    value,
    isMasterNumber: false,
    ruler: rulerFor(value),
    workings: day === value ? `born on the ${day} → ${value}` : `born on the ${day} → ${digitSum(day)} → ${value}`,
  };
}

function letterBreakdown(letters: string): string {
  return letters
    .split("")
    .map((letter) => `${letter}=${CHALDEAN_LETTER_VALUES[letter] ?? 0}`)
    .join(" ");
}

/** Name Number: Chaldean sum of every letter, reduced with masters preserved. */
export function calculateNameNumber(name: string): NumerologyNumber | null {
  const letters = normalizeNameForNumerology(name);
  if (!letters) return null;

  const total = chaldeanSum(letters);
  const value = reduceKeepingMasters(total);

  return {
    key: "nameNumber",
    label: "Name Number",
    value,
    isMasterNumber: isMasterNumber(value),
    ruler: rulerFor(value),
    workings: `${letterBreakdown(letters)} = ${total} → ${value}`,
  };
}

/** Soul Urge: Chaldean sum of the vowels only. */
export function calculateSoulUrge(name: string): NumerologyNumber | null {
  const letters = normalizeNameForNumerology(name)
    .split("")
    .filter((letter) => VOWELS.has(letter))
    .join("");
  if (!letters) return null;

  const total = chaldeanSum(letters);
  const value = reduceKeepingMasters(total);

  return {
    key: "soulUrge",
    label: "Soul Urge Number",
    value,
    isMasterNumber: isMasterNumber(value),
    ruler: rulerFor(value),
    workings: `vowels ${letterBreakdown(letters)} = ${total} → ${value}`,
  };
}

/** Personality: Chaldean sum of the consonants only. */
export function calculatePersonality(name: string): NumerologyNumber | null {
  const letters = normalizeNameForNumerology(name)
    .split("")
    .filter((letter) => !VOWELS.has(letter))
    .join("");
  if (!letters) return null;

  const total = chaldeanSum(letters);
  const value = reduceKeepingMasters(total);

  return {
    key: "personality",
    label: "Personality Number",
    value,
    isMasterNumber: isMasterNumber(value),
    ruler: rulerFor(value),
    workings: `consonants ${letterBreakdown(letters)} = ${total} → ${value}`,
  };
}

export function calculateNumerology(input: NumerologyInput): NumerologyResult {
  const numbers: NumerologyNumber[] = [calculateLifePath(input.dateOfBirth), calculateBirthNumber(input.dateOfBirth)];
  const unavailable: NumerologyResult["unavailable"] = [];

  const trimmedName = input.name?.trim() ?? "";

  if (trimmedName) {
    const nameBased = [
      calculateNameNumber(trimmedName),
      calculateSoulUrge(trimmedName),
      calculatePersonality(trimmedName),
    ];

    for (const [index, number] of nameBased.entries()) {
      if (number) {
        numbers.push(number);
      } else {
        unavailable.push({
          label: ["Name Number", "Soul Urge Number", "Personality Number"][index],
          reason: "The name contains no letters this system can score.",
        });
      }
    }
  } else {
    unavailable.push(
      { label: "Name Number", reason: "Add a name to calculate this number." },
      { label: "Soul Urge Number", reason: "Add a name to calculate this number." },
      { label: "Personality Number", reason: "Add a name to calculate this number." },
    );
  }

  return {
    system: "chaldean",
    dateOfBirth: input.dateOfBirth,
    name: trimmedName || null,
    numbers,
    unavailable,
  };
}
