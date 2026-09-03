/**
 * Numerology domain types.
 *
 * `workings` on each number is the arithmetic that produced it, so the page can
 * show its work and a reader can check the result by hand.
 */
export type NumerologyNumber = {
  key: "lifePath" | "birthNumber" | "nameNumber" | "soulUrge" | "personality";
  label: string;
  value: number;
  isMasterNumber: boolean;
  ruler: string;
  /** Human-readable derivation, e.g. "1+4 + 0+8 + 1+9+9+2 = 34 → 3+4 = 7". */
  workings: string;
};

export type NumerologyResult = {
  system: "chaldean";
  dateOfBirth: string;
  name: string | null;
  numbers: NumerologyNumber[];
  /** Numbers that could not be calculated, with the reason. */
  unavailable: Array<{ label: string; reason: string }>;
};

export type NumerologyInput = {
  dateOfBirth: string;
  name?: string | null;
};
