import {
  DEGREES_PER_SIGN,
  getDegreeInSign,
  getSignNumber,
  normalizeSign,
} from "@/lib/astrology/charts/signs";
import { getNavamsaStartSign } from "@/lib/astrology/charts/navamsa";
import { ChartDataError } from "@/lib/astrology/charts/types";

/**
 * The Shodashvarga - sixteen divisional charts from one longitude.
 *
 * Almost every varga is the same shape: cut the sign into N equal parts, decide
 * which sign the sequence *starts* from, and count forward. Only the starting
 * rule differs between them, so that rule is the only thing each division
 * declares here. Sixteen separate implementations would be sixteen places for
 * the same boundary bug to hide.
 *
 * Trimshamsha (D30) is the one genuine exception - its five parts are unequal
 * and skip the luminaries - so it carries an explicit segment table instead.
 *
 * Every mapping is derived from the longitude, never from the D1 house number.
 * A house is a function of the ascendant; a varga is a property of where the
 * planet actually is. Deriving from the house would make a planet's D9 change
 * because someone was born ten minutes later, which is not what a varga means.
 *
 * Methodology is Parashari, and the variants chosen are documented in
 * `docs/astrology-methodology.md`. Where traditions genuinely disagree the
 * choice is recorded there rather than silently baked in.
 */

/** Sign qualities. Movable signs are 1, 4, 7, 10; the cycle repeats every 3. */
function quality(sign: number): 0 | 1 | 2 {
  return ((normalizeSign(sign) - 1) % 3) as 0 | 1 | 2;
}

/** Elements cycle every 4 from Aries: fire, earth, air, water. */
function element(sign: number): 0 | 1 | 2 | 3 {
  return ((normalizeSign(sign) - 1) % 4) as 0 | 1 | 2 | 3;
}

function isOdd(sign: number): boolean {
  return normalizeSign(sign) % 2 === 1;
}

/** Aries, Leo, Sagittarius - the starts used by several vargas. */
const ARIES = 1;
const CANCER = 4;
const LEO = 5;
const LIBRA = 7;
const SAGITTARIUS = 9;
const CAPRICORN = 10;

type EqualRule = {
  kind: "equal";
  divisions: number;
  /** Which sign this sign's sequence counts from. */
  startSign: (sign: number) => number;
  /**
   * Signs advanced per part. One for most vargas, but not all: a Drekkana runs
   * to the 5th and the 9th from its sign, and a Chaturthamsha to the 4th, 7th
   * and 10th - so those step 4 and 3 rather than landing on adjacent signs.
   */
  step?: number;
};

type UnequalSegment = {
  /** Degrees from the start of the sign where this segment begins. */
  from: number;
  /** Degrees from the start of the sign where it ends. */
  to: number;
  /** The varga sign this segment maps to. */
  sign: number;
};

type UnequalRule = {
  kind: "unequal";
  /** Segments for an odd sign and for an even one, each covering 0-30. */
  odd: UnequalSegment[];
  even: UnequalSegment[];
};

export type VargaRule = EqualRule | UnequalRule;

export type VargaDefinition = {
  division: number;
  /** Classical name. */
  name: string;
  /** What the chart is traditionally read for. Display only. */
  significance: string;
  rule: VargaRule;
};

/**
 * Trimshamsha (D30).
 *
 * Five unequal parts ruled by the five non-luminaries - the Sun and Moon take
 * no trimshamsha - and the order reverses between odd and even signs. Each lord
 * contributes the sign of its own parity: Mars gives Aries in an odd sign and
 * Scorpio in an even one.
 */
const TRIMSHAMSHA_ODD: UnequalSegment[] = [
  { from: 0, to: 5, sign: ARIES }, // Mars
  { from: 5, to: 10, sign: 11 }, // Saturn - Aquarius
  { from: 10, to: 18, sign: SAGITTARIUS }, // Jupiter
  { from: 18, to: 25, sign: 3 }, // Mercury - Gemini
  { from: 25, to: 30, sign: LIBRA }, // Venus
];

const TRIMSHAMSHA_EVEN: UnequalSegment[] = [
  { from: 0, to: 5, sign: 2 }, // Venus - Taurus
  { from: 5, to: 12, sign: 6 }, // Mercury - Virgo
  { from: 12, to: 20, sign: 12 }, // Jupiter - Pisces
  { from: 20, to: 25, sign: CAPRICORN }, // Saturn
  { from: 25, to: 30, sign: 8 }, // Mars - Scorpio
];

export const VARGA_DEFINITIONS: readonly VargaDefinition[] = [
  {
    division: 1,
    name: "Rashi",
    significance: "The birth chart itself",
    rule: { kind: "equal", divisions: 1, startSign: (sign) => sign },
  },
  {
    division: 2,
    name: "Hora",
    significance: "Wealth and resources",
    // Only Cancer and Leo ever occur: the Sun's hora and the Moon's. An odd
    // sign gives Leo first, an even sign Cancer first.
    rule: {
      kind: "unequal",
      odd: [
        { from: 0, to: 15, sign: LEO },
        { from: 15, to: 30, sign: CANCER },
      ],
      even: [
        { from: 0, to: 15, sign: CANCER },
        { from: 15, to: 30, sign: LEO },
      ],
    },
  },
  {
    division: 3,
    name: "Drekkana",
    significance: "Siblings and courage",
    // 1st third from the sign, 2nd from the 5th, 3rd from the 9th.
    rule: { kind: "equal", divisions: 3, startSign: (sign) => sign, step: 4 },
  },
  {
    division: 4,
    name: "Chaturthamsha",
    significance: "Property and fortune",
    // The sign, then the 4th, 7th and 10th from it - the angles.
    rule: { kind: "equal", divisions: 4, startSign: (sign) => sign, step: 3 },
  },
  {
    division: 7,
    name: "Saptamsha",
    significance: "Children and progeny",
    rule: {
      kind: "equal",
      divisions: 7,
      startSign: (sign) => (isOdd(sign) ? sign : normalizeSign(sign + 6)),
    },
  },
  {
    division: 9,
    name: "Navamsha",
    significance: "Marriage and dharma",
    // Reuses the existing, tested navamsa rule rather than restating it.
    rule: { kind: "equal", divisions: 9, startSign: getNavamsaStartSign },
  },
  {
    division: 10,
    name: "Dashamsha",
    significance: "Career and profession",
    rule: {
      kind: "equal",
      divisions: 10,
      startSign: (sign) => (isOdd(sign) ? sign : normalizeSign(sign + 8)),
    },
  },
  {
    division: 12,
    name: "Dwadashamsha",
    significance: "Parents and ancestry",
    rule: { kind: "equal", divisions: 12, startSign: (sign) => sign },
  },
  {
    division: 16,
    name: "Shodashamsha",
    significance: "Vehicles and comforts",
    rule: {
      kind: "equal",
      divisions: 16,
      startSign: (sign) => [ARIES, LEO, SAGITTARIUS][quality(sign)],
    },
  },
  {
    division: 20,
    name: "Vimshamsha",
    significance: "Spiritual inclination",
    rule: {
      kind: "equal",
      divisions: 20,
      startSign: (sign) => [ARIES, SAGITTARIUS, LEO][quality(sign)],
    },
  },
  {
    division: 24,
    name: "Chaturvimshamsha",
    significance: "Education and learning",
    rule: {
      kind: "equal",
      divisions: 24,
      startSign: (sign) => (isOdd(sign) ? LEO : CANCER),
    },
  },
  {
    division: 27,
    name: "Saptavimshamsha",
    significance: "Strengths and weaknesses",
    rule: {
      kind: "equal",
      divisions: 27,
      startSign: (sign) => [ARIES, CANCER, LIBRA, CAPRICORN][element(sign)],
    },
  },
  {
    division: 30,
    name: "Trimshamsha",
    significance: "Misfortune and adversity",
    rule: { kind: "unequal", odd: TRIMSHAMSHA_ODD, even: TRIMSHAMSHA_EVEN },
  },
  {
    division: 40,
    name: "Khavedamsha",
    significance: "Auspicious and ancestral indications",
    rule: {
      kind: "equal",
      divisions: 40,
      startSign: (sign) => (isOdd(sign) ? ARIES : LIBRA),
    },
  },
  {
    division: 45,
    name: "Akshavedamsha",
    significance: "Character and general well-being",
    rule: {
      kind: "equal",
      divisions: 45,
      startSign: (sign) => [ARIES, LEO, SAGITTARIUS][quality(sign)],
    },
  },
  {
    division: 60,
    name: "Shashtiamsha",
    significance: "Fine karmic indications",
    rule: { kind: "equal", divisions: 60, startSign: (sign) => sign },
  },
];

export const SUPPORTED_DIVISIONS = VARGA_DEFINITIONS.map((varga) => varga.division);

const BY_DIVISION = new Map(VARGA_DEFINITIONS.map((varga) => [varga.division, varga]));

export function getVargaDefinition(division: number): VargaDefinition {
  const definition = BY_DIVISION.get(division);
  if (!definition) {
    throw new ChartDataError(`Unsupported varga: D${division}.`);
  }
  return definition;
}

/**
 * Which part of its sign a longitude falls in, 0 to divisions-1.
 *
 * The epsilon is the same guard the navamsa uses and matters for the same
 * reason: a boundary such as 3°20' is 3.3333... in binary, and a provider may
 * hand over a value a hair under it. Without the nudge the planet lands one
 * part early, which in a D60 is a different sign.
 */
export function getVargaIndex(longitude: number, divisions: number): number {
  const arc = DEGREES_PER_SIGN / divisions;
  const raw = getDegreeInSign(longitude) / arc;
  const snapped = Math.abs(raw - Math.round(raw)) < 1e-9 ? Math.round(raw) : raw;

  return Math.min(divisions - 1, Math.max(0, Math.floor(snapped)));
}

export type VargaPosition = {
  division: number;
  /** 1-12. */
  sign: number;
  /** 0 <= degree < 30, the position scaled across the varga sign. */
  degreeInSign: number;
  /** Which part of the rashi sign the longitude fell in, 0-based. */
  index: number;
};

/**
 * A longitude's position in one divisional chart.
 *
 * The degree is scaled, not carried over: a navamsa is 3°20' of the rashi and
 * the D9 spreads that arc across a whole sign, so a planet 1°40' into its
 * navamsa is at 15° of the D9 sign. Carrying the rashi degree across would pair
 * a degree with a sign it does not belong to, and nothing in the label would
 * tell a reader the two disagree.
 */
export function calculateVarga(longitude: number, division: number): VargaPosition {
  const { rule } = getVargaDefinition(division);
  const sign = getSignNumber(longitude);
  const degreeInSign = getDegreeInSign(longitude);

  if (rule.kind === "equal") {
    const index = getVargaIndex(longitude, rule.divisions);
    const arc = DEGREES_PER_SIGN / rule.divisions;
    const within = degreeInSign - index * arc;

    return {
      division,
      sign: normalizeSign(rule.startSign(sign) + index * (rule.step ?? 1)),
      degreeInSign: Math.min(DEGREES_PER_SIGN, Math.max(0, within * rule.divisions)),
      index,
    };
  }

  const segments = isOdd(sign) ? rule.odd : rule.even;
  const index = segments.findIndex(
    (segment, position) =>
      degreeInSign >= segment.from &&
      (degreeInSign < segment.to || position === segments.length - 1),
  );
  const segment = segments[index === -1 ? segments.length - 1 : index];
  const width = segment.to - segment.from;

  return {
    division,
    sign: normalizeSign(segment.sign),
    // An unequal segment still spreads across a whole sign, so the scale is the
    // segment's own width rather than a fixed division count.
    degreeInSign: Math.min(
      DEGREES_PER_SIGN,
      Math.max(0, ((degreeInSign - segment.from) / width) * DEGREES_PER_SIGN),
    ),
    index: index === -1 ? segments.length - 1 : index,
  };
}

/** The varga sign alone, for callers that do not need the degree. */
export function getVargaSign(longitude: number, division: number): number {
  return calculateVarga(longitude, division).sign;
}
