import { NAKSHATRAS, SIGNS, type NakshatraName, type ZodiacSign } from "@/config/astrology";

/**
 * Ashtakoota (Guna Milan): the eight-fold compatibility comparison.
 *
 * A deliberate line runs through this file. The astronomy in this engine is
 * verified against JPL Horizons, an independent authority. These are not
 * astronomy - they are classical rule tables - and no comparable authority is
 * available to check them against.
 *
 * So only the kootas whose rule is unambiguous are calculated here: three of
 * them are pure arithmetic on a nakshatra or sign number, and the fourth is a
 * classification with a binary outcome. The remaining four need lookup tables
 * whose details differ between sources - the Yoni compatibility matrix alone
 * has nearly two hundred entries, and Gana and Graha Maitri are scored
 * differently by different authorities.
 *
 * Those four return null, which the result type is built for, rather than a
 * number that would look exactly as authoritative as the calculated ones.
 * Presenting a guessed koota score beside a computed one is the failure mode
 * worth avoiding here: the user cannot tell them apart, and the total would
 * carry the guess into every decision made on it.
 */

export type KootaComputation = {
  key: string;
  name: string;
  maxScore: number;
  score: number | null;
  details: string | null;
};

const nakshatraIndex = (name: NakshatraName) => NAKSHATRAS.indexOf(name);
const signIndex = (sign: ZodiacSign) => SIGNS.indexOf(sign);

/* ------------------------------------------------------------------ */
/* Varna: 1 point                                                      */
/* ------------------------------------------------------------------ */

/** The four varnas, highest first. Water signs rank highest, air lowest. */
type Varna = "Brahmin" | "Kshatriya" | "Vaishya" | "Shudra";
const VARNA_RANK: Record<Varna, number> = { Brahmin: 4, Kshatriya: 3, Vaishya: 2, Shudra: 1 };

function varnaOf(sign: ZodiacSign): Varna {
  // Water signs are Brahmin, fire Kshatriya, earth Vaishya, air Shudra.
  const water = ["Cancer", "Scorpio", "Pisces"];
  const fire = ["Aries", "Leo", "Sagittarius"];
  const earth = ["Taurus", "Virgo", "Capricorn"];
  if (water.includes(sign)) return "Brahmin";
  if (fire.includes(sign)) return "Kshatriya";
  if (earth.includes(sign)) return "Vaishya";
  return "Shudra";
}

function varna(groomSign: ZodiacSign, brideSign: ZodiacSign): KootaComputation {
  const groom = varnaOf(groomSign);
  const bride = varnaOf(brideSign);
  const score = VARNA_RANK[groom] >= VARNA_RANK[bride] ? 1 : 0;

  return {
    key: "varna",
    name: "Varna",
    maxScore: 1,
    score,
    details: `Groom's Moon sign is ${groom}, bride's is ${bride}. The point is given when the groom's varna is not below the bride's.`,
  };
}

/* ------------------------------------------------------------------ */
/* Tara: 3 points                                                      */
/* ------------------------------------------------------------------ */

/** The third, fifth and seventh counts are the inauspicious taras. */
const INAUSPICIOUS_TARAS = new Set([3, 5, 7]);

function tara(groom: NakshatraName, bride: NakshatraName): KootaComputation {
  const count = (from: NakshatraName, to: NakshatraName) => {
    const steps = ((nakshatraIndex(to) - nakshatraIndex(from) + 27) % 27) + 1;
    const remainder = steps % 9;
    return remainder === 0 ? 9 : remainder;
  };

  const fromBride = count(bride, groom);
  const fromGroom = count(groom, bride);

  // Each direction is worth half the koota.
  const score =
    (INAUSPICIOUS_TARAS.has(fromBride) ? 0 : 1.5) + (INAUSPICIOUS_TARAS.has(fromGroom) ? 0 : 1.5);

  return {
    key: "tara",
    name: "Tara",
    maxScore: 3,
    score,
    details: `Counting from the bride's nakshatra to the groom's gives ${fromBride}, and the reverse gives ${fromGroom}. The third, fifth and seventh counts score nothing.`,
  };
}

/* ------------------------------------------------------------------ */
/* Bhakoot: 7 points                                                   */
/* ------------------------------------------------------------------ */

function bhakoot(groomSign: ZodiacSign, brideSign: ZodiacSign): KootaComputation {
  const forward = ((signIndex(brideSign) - signIndex(groomSign) + 12) % 12) + 1;
  const reverse = ((signIndex(groomSign) - signIndex(brideSign) + 12) % 12) + 1;

  // The 6/8, 5/9 and 2/12 relationships between the Moon signs score nothing.
  const pair = [forward, reverse].sort((a, b) => a - b).join("/");
  const blocked = ["6/8", "5/9", "2/12"].includes(pair);

  return {
    key: "bhakoot",
    name: "Bhakoot",
    maxScore: 7,
    score: blocked ? 0 : 7,
    details: blocked
      ? `The Moon signs stand in a ${pair} relationship, which scores nothing.`
      : `The Moon signs stand in a ${pair} relationship, which is not one of the blocked pairs.`,
  };
}

/* ------------------------------------------------------------------ */
/* Nadi: 8 points                                                      */
/* ------------------------------------------------------------------ */

/**
 * Nadi by nakshatra. The three nadis do not repeat in a simple cycle, so the
 * membership is listed rather than derived.
 */
const NADI_MEMBERS: Record<"Adi" | "Madhya" | "Antya", number[]> = {
  Adi: [0, 5, 6, 11, 12, 17, 18, 23, 24],
  Madhya: [1, 4, 7, 10, 13, 16, 19, 22, 25],
  Antya: [2, 3, 8, 9, 14, 15, 20, 21, 26],
};

function nadiOf(nakshatra: NakshatraName): "Adi" | "Madhya" | "Antya" {
  const index = nakshatraIndex(nakshatra);
  for (const [nadi, members] of Object.entries(NADI_MEMBERS)) {
    if (members.includes(index)) return nadi as "Adi" | "Madhya" | "Antya";
  }
  throw new Error(`No nadi is defined for ${nakshatra}.`);
}

function nadi(groom: NakshatraName, bride: NakshatraName): KootaComputation {
  const groomNadi = nadiOf(groom);
  const brideNadi = nadiOf(bride);
  const same = groomNadi === brideNadi;

  return {
    key: "nadi",
    name: "Nadi",
    maxScore: 8,
    score: same ? 0 : 8,
    details: same
      ? `Both are ${groomNadi} nadi. A shared nadi scores nothing, and this is the koota given the most weight.`
      : `Groom is ${groomNadi} nadi and bride is ${brideNadi}, so the full score applies.`,
  };
}

/* ------------------------------------------------------------------ */
/* The four that are not calculated                                    */
/* ------------------------------------------------------------------ */

/**
 * Kootas that need a lookup table this engine does not have a trustworthy
 * source for. Each says what is missing rather than reporting a zero, because
 * a zero is a result and this is an absence.
 */
const UNCALCULATED: KootaComputation[] = [
  {
    key: "vashya",
    name: "Vashya",
    maxScore: 2,
    score: null,
    details:
      "Not calculated. Vashya groups two signs by half, and sources differ on where those halves fall.",
  },
  {
    key: "yoni",
    name: "Yoni",
    maxScore: 4,
    score: null,
    details:
      "Not calculated. Yoni needs a compatibility matrix over fourteen animal symbols that this engine has no verified source for.",
  },
  {
    key: "grahaMaitri",
    name: "Graha Maitri",
    maxScore: 5,
    score: null,
    details:
      "Not calculated. The planetary friendship scale is scored differently by different authorities.",
  },
  {
    key: "gana",
    name: "Gana",
    maxScore: 6,
    score: null,
    details:
      "Not calculated. Sources disagree on the score for several Deva, Manushya and Rakshasa pairings.",
  },
];

export type AshtakootaResult = {
  kootas: KootaComputation[];
  /** Sum of the kootas that were calculated. Never completed with guesses. */
  score: number;
  /** Maximum available from the calculated kootas alone. */
  availableMax: number;
  /** The traditional total, for context only. */
  traditionalMax: number;
};

/**
 * Compares two charts by their Moon positions.
 *
 * The whole comparison rests on the Moon's nakshatra and sign, which is why
 * getting the Moon right mattered enough to implement ELP 2000-82B rather than
 * an approximation.
 */
export function computeAshtakoota(
  groom: { moonSign: ZodiacSign; moonNakshatra: NakshatraName },
  bride: { moonSign: ZodiacSign; moonNakshatra: NakshatraName },
): AshtakootaResult {
  const calculated = [
    varna(groom.moonSign, bride.moonSign),
    tara(groom.moonNakshatra, bride.moonNakshatra),
    bhakoot(groom.moonSign, bride.moonSign),
    nadi(groom.moonNakshatra, bride.moonNakshatra),
  ];

  // Traditional order, so the table reads the way a practitioner expects.
  const order = ["varna", "vashya", "tara", "yoni", "grahaMaitri", "gana", "bhakoot", "nadi"];
  const kootas = [...calculated, ...UNCALCULATED].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
  );

  return {
    kootas,
    score: calculated.reduce((total, koota) => total + (koota.score ?? 0), 0),
    availableMax: calculated.reduce((total, koota) => total + koota.maxScore, 0),
    traditionalMax: 36,
  };
}
