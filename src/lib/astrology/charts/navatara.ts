import { NAKSHATRAS, type NakshatraName } from "@/config/astrology";
import { getNakshatraNumber } from "@/lib/astrology/kp/vimshottari";

/**
 * Navatara: the twenty-seven nakshatras read as nine, three times over.
 *
 * Counting from the birth nakshatra, every ninth is the same tara again - so
 * the twenty-seven fall into nine groups that each recur three times. The
 * count is inclusive: the birth nakshatra is itself the first, Janma.
 *
 * This is arithmetic, not interpretation. The classical names carry strong
 * associations - Vipat is "danger", Naidhana is "death" - and none of that is
 * encoded here. A tara is a position in a cycle; what it means belongs to a
 * reading, and putting it in a calculation would make the number look like a
 * verdict.
 */

/** The nine taras, in order, counted inclusively from the birth star. */
export const TARAS = [
  "Janma",
  "Sampat",
  "Vipat",
  "Kshema",
  "Pratyari",
  "Sadhaka",
  "Naidhana",
  "Mitra",
  "Parama Mitra",
] as const;

export type Tara = (typeof TARAS)[number];

export type NavataraEntry = {
  nakshatra: NakshatraName;
  /** 1-27, absolute. */
  number: number;
  /** 1-27, counted from the birth nakshatra inclusively. */
  fromBirth: number;
  /** 1-9. */
  taraNumber: number;
  tara: Tara;
  /** Which of the three turns through the nine this is, 1-3. */
  cycle: number;
};

/** The tara a nakshatra holds, counted from the birth star. */
export function taraFor(birthNakshatra: number, target: number): { taraNumber: number; tara: Tara; cycle: number } {
  // Inclusive count: the birth star is the 1st, not the 0th.
  const fromBirth = ((target - birthNakshatra + 27) % 27) + 1;
  const taraNumber = ((fromBirth - 1) % 9) + 1;

  return {
    taraNumber,
    tara: TARAS[taraNumber - 1],
    cycle: Math.floor((fromBirth - 1) / 9) + 1,
  };
}

/** The full twenty-seven, in order from the birth nakshatra. */
export function calculateNavatara(moonLongitude: number): {
  birthNakshatra: NakshatraName;
  entries: NavataraEntry[];
} {
  const birth = getNakshatraNumber(moonLongitude);

  const entries = Array.from({ length: 27 }, (_, step) => {
    const number = ((birth - 1 + step) % 27) + 1;
    const { taraNumber, tara, cycle } = taraFor(birth, number);

    return {
      nakshatra: NAKSHATRAS[number - 1],
      number,
      fromBirth: step + 1,
      taraNumber,
      tara,
      cycle,
    };
  });

  return { birthNakshatra: NAKSHATRAS[birth - 1], entries };
}
