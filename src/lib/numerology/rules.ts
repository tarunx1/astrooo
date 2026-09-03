/**
 * Numerology rules.
 *
 * Deterministic arithmetic only. No model is ever consulted for a number, and
 * every rule here is stated explicitly so a result can be reproduced by hand.
 *
 * System: **Chaldean** for name numerology. Chosen deliberately for an
 * India-facing product, where Chaldean is the system in common use, and it is
 * never mixed with Pythagorean. See docs/numerology-methodology.md.
 */

/** Master numbers are preserved during reduction rather than reduced to one digit. */
export const MASTER_NUMBERS = [11, 22, 33] as const;

export type MasterNumber = (typeof MASTER_NUMBERS)[number];

export function isMasterNumber(value: number): value is MasterNumber {
  return (MASTER_NUMBERS as readonly number[]).includes(value);
}

/**
 * Reduces to a single digit, stopping at a master number.
 *
 * `reduceToSingleDigit(29)` → 2+9 = 11, which is a master number, so 11.
 * `reduceToSingleDigit(39)` → 3+9 = 12 → 1+2 = 3.
 */
export function reduceKeepingMasters(value: number): number {
  let current = Math.abs(Math.trunc(value));

  while (current > 9 && !isMasterNumber(current)) {
    current = digitSum(current);
  }

  return current;
}

/** Reduces fully to 1-9, ignoring master numbers. Used where tradition requires it. */
export function reduceToSingleDigit(value: number): number {
  let current = Math.abs(Math.trunc(value));
  while (current > 9) current = digitSum(current);
  return current;
}

export function digitSum(value: number): number {
  return String(Math.abs(Math.trunc(value)))
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

/**
 * Chaldean letter values.
 *
 * Chaldean assigns 1-8 only; 9 is considered sacred and is not assigned to any
 * letter. This is the defining difference from Pythagorean and the reason the
 * two must never be mixed.
 */
export const CHALDEAN_LETTER_VALUES: Record<string, number> = {
  A: 1, I: 1, J: 1, Q: 1, Y: 1,
  B: 2, K: 2, R: 2,
  C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4,
  E: 5, H: 5, N: 5, X: 5,
  U: 6, V: 6, W: 6,
  O: 7, Z: 7,
  F: 8, P: 8,
};

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/** Keeps A-Z only; spaces, punctuation, digits and accents are ignored. */
export function normalizeNameForNumerology(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export function chaldeanSum(letters: string): number {
  return letters.split("").reduce((sum, letter) => sum + (CHALDEAN_LETTER_VALUES[letter] ?? 0), 0);
}

/** Traditional planetary rulers of numbers 1-9 in Indian numerology. */
export const NUMBER_RULERS: Record<number, string> = {
  1: "Sun",
  2: "Moon",
  3: "Jupiter",
  4: "Rahu",
  5: "Mercury",
  6: "Venus",
  7: "Ketu",
  8: "Saturn",
  9: "Mars",
};

/**
 * Ruler for a number, including master numbers.
 *
 * A master number is attributed to the ruler of its reduced digit, with the
 * master status reported separately rather than hidden.
 */
export function rulerFor(value: number): string {
  return NUMBER_RULERS[isMasterNumber(value) ? reduceToSingleDigit(value) : value] ?? "Unassigned";
}
