import { NAKSHATRAS, type NakshatraName, type PlanetName } from "@/config/astrology";
import { getHouseFromSign } from "@/lib/astrology/charts/houses";
import { getSignNumber, normalizeLongitude } from "@/lib/astrology/charts/signs";

/**
 * Vimshottari subdivision, and the KP sub-lord it produces.
 *
 * Krishnamurti Paddhati's central idea is that a nakshatra is too coarse to
 * distinguish two people born minutes apart, so each is divided again in the
 * proportions of the Vimshottari dasha. That yields 249 divisions across the
 * zodiac, and the lord of the division a point falls in - its sub lord - is
 * what KP reads.
 *
 * This is exact arithmetic on a longitude: no ephemeris, no house system and
 * nothing approximated. The same longitude always produces the same lords.
 */

/** Dasha order and years. The order is the sequence, not the sort. */
export const VIMSHOTTARI_SEQUENCE: ReadonlyArray<{ lord: PlanetName; years: number }> = [
  { lord: "Ketu", years: 7 },
  { lord: "Venus", years: 20 },
  { lord: "Sun", years: 6 },
  { lord: "Moon", years: 10 },
  { lord: "Mars", years: 7 },
  { lord: "Rahu", years: 18 },
  { lord: "Jupiter", years: 16 },
  { lord: "Saturn", years: 19 },
  { lord: "Mercury", years: 17 },
] as const;

export const VIMSHOTTARI_TOTAL_YEARS = 120;
export const NAKSHATRA_COUNT = 27;
/** 360 / 27 = 13°20'. */
export const NAKSHATRA_ARC = 360 / NAKSHATRA_COUNT;
/** One quarter of a nakshatra: 3°20'. */
export const PADA_ARC = NAKSHATRA_ARC / 4;

export type KpPosition = {
  longitude: number;
  nakshatra: NakshatraName;
  /** 1-27. */
  nakshatraNumber: number;
  /** 1-4. */
  pada: number;
  /** Lord of the nakshatra. KP calls this the star lord. */
  starLord: PlanetName;
  /** Lord of the Vimshottari subdivision within the nakshatra. */
  subLord: PlanetName;
  /** Lord of the subdivision within the sub. Used to separate near-identical charts. */
  subSubLord: PlanetName;
  /** House significations (occupied + owned houses). */
  planetHouses?: number[];
  starLordHouses?: number[];
  subLordHouses?: number[];
  subSubLordHouses?: number[];
};

/** Sign rulership mapping for traditional Vedic planets (Aries=1 to Pisces=12). */
export const PLANET_SIGN_RULERSHIPS: Record<PlanetName, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11],
  Rahu: [],
  Ketu: [],
};

export function getSignLord(sign: number): PlanetName {
  const normalized = ((sign - 1) % 12 + 1);
  switch (normalized) {
    case 1: return "Mars";
    case 2: return "Venus";
    case 3: return "Mercury";
    case 4: return "Moon";
    case 5: return "Sun";
    case 6: return "Mercury";
    case 7: return "Venus";
    case 8: return "Mars";
    case 9: return "Jupiter";
    case 10: return "Saturn";
    case 11: return "Saturn";
    case 12: return "Jupiter";
    default: return "Mars";
  }
}

/**
 * Computes house significations (houses occupied and owned) for a planet given
 * the chart's ascendant sign and list of planetary positions.
 */
export function getKpHouseSignifications(
  planet: PlanetName,
  ascendantSign: number,
  allPlanets?: Array<{ planet: PlanetName; sign: number | string; longitude: number }>
): number[] {
  const houses = new Set<number>();

  // 1. Occupation
  if (allPlanets) {
    const target = allPlanets.find((p) => p.planet === planet);
    if (target) {
      const occupiedSign = typeof target.sign === "number" ? target.sign : getSignNumber(target.longitude);
      const occupiedHouse = getHouseFromSign(occupiedSign, ascendantSign);
      houses.add(occupiedHouse);

      // Handle Rahu / Ketu proxy rules in KP / Nadi astrology:
      // Nodes signify the houses of their sign lord.
      if (planet === "Rahu" || planet === "Ketu") {
        const signLord = getSignLord(occupiedSign);
        if (signLord && signLord !== planet) {
          const proxyOwned = PLANET_SIGN_RULERSHIPS[signLord] ?? [];
          for (const sign of proxyOwned) {
            houses.add(getHouseFromSign(sign, ascendantSign));
          }
        }
      }
    }
  }

  // 2. Ownership
  const ownedSigns = PLANET_SIGN_RULERSHIPS[planet] ?? [];
  for (const sign of ownedSigns) {
    const house = getHouseFromSign(sign, ascendantSign);
    houses.add(house);
  }

  return Array.from(houses).sort((a, b) => a - b);
}

/** Index into the sequence, wrapped, so lord arithmetic reads plainly. */
function lordAt(index: number): { lord: PlanetName; years: number } {
  const size = VIMSHOTTARI_SEQUENCE.length;
  return VIMSHOTTARI_SEQUENCE[((index % size) + size) % size];
}

/**
 * Nudges a value that is within a rounding error of a boundary onto it.
 *
 * KP divisions are narrow - the smallest sub is under an arc-minute of the
 * zodiac in places - so a longitude a hair under a boundary must not fall into
 * the previous division. This is the same hazard as the navamsa boundaries,
 * with far less room for error.
 */
function snap(value: number): number {
  const rounded = Math.round(value);
  // Tight on purpose, and tighter than it first looks necessary: dividing a
  // longitude by the 13°20' nakshatra arc shrinks any offset by more than
  // thirteen times, so a position a nanodegree short of a boundary arrives here
  // as 7.5e-11. The tolerance has to sit below that or it would pull a real
  // position onto the boundary it was deliberately short of, while still
  // absorbing genuine float error, which is around 1e-15 here.
  return Math.abs(value - rounded) < 1e-12 ? rounded : value;
}

/** Which nakshatra a longitude falls in, 1-27. */
export function getNakshatraNumber(longitude: number): number {
  const index = Math.floor(snap(normalizeLongitude(longitude) / NAKSHATRA_ARC));
  return Math.min(NAKSHATRA_COUNT, Math.max(1, index + 1));
}

export function getNakshatraName(longitude: number): NakshatraName {
  return NAKSHATRAS[getNakshatraNumber(longitude) - 1];
}

/** Which quarter of its nakshatra, 1-4. */
export function getPada(longitude: number): number {
  const within = normalizeLongitude(longitude) % NAKSHATRA_ARC;
  return Math.min(4, Math.floor(snap(within / PADA_ARC)) + 1);
}

/**
 * Lord of the nakshatra containing a longitude.
 *
 * The 27 nakshatras cycle through the nine Vimshottari lords three times, so
 * the lord is the nakshatra number modulo nine.
 */
export function getStarLord(longitude: number): PlanetName {
  return lordAt(getNakshatraNumber(longitude) - 1).lord;
}

/**
 * Divides a span in Vimshottari proportion, starting from a given lord.
 *
 * Used for each level of the subdivision: the nakshatra into subs, and a sub
 * into sub-subs. Returns the lord whose slice contains `offset`, along with
 * that slice, so the next level can recurse into it.
 */
function subdivide(
  startLordIndex: number,
  spanStart: number,
  spanWidth: number,
  offset: number,
): { lordIndex: number; start: number; width: number } {
  let cursor = spanStart;

  for (let step = 0; step < VIMSHOTTARI_SEQUENCE.length; step += 1) {
    const index = startLordIndex + step;
    const width = (lordAt(index).years / VIMSHOTTARI_TOTAL_YEARS) * spanWidth;

    // The final slice absorbs any floating-point remainder, so a longitude at
    // the very end of a nakshatra can never fall past every slice.
    const isLast = step === VIMSHOTTARI_SEQUENCE.length - 1;
    if (isLast || snap(offset) < snap(cursor + width)) {
      return { lordIndex: index, start: cursor, width };
    }

    cursor += width;
  }

  // Unreachable: the loop always returns on its final iteration.
  return { lordIndex: startLordIndex, start: spanStart, width: spanWidth };
}

/**
 * Full KP position for a longitude.
 *
 * The three lords are nested: the sub divides the star, and the sub-sub divides
 * the sub. Each level starts from the lord of the level above, which is what
 * makes the sequence deterministic rather than arbitrary.
 */
export function getKpPosition(
  longitude: number,
  ascendantSign?: number,
  allPlanets?: Array<{ planet: PlanetName; sign: number | string; longitude: number }>,
  planetName?: PlanetName
): KpPosition {
  const normalized = normalizeLongitude(longitude);
  const nakshatraNumber = getNakshatraNumber(normalized);
  const starIndex = nakshatraNumber - 1;
  const nakshatraStart = starIndex * NAKSHATRA_ARC;

  const sub = subdivide(starIndex, nakshatraStart, NAKSHATRA_ARC, normalized);
  const subSub = subdivide(sub.lordIndex, sub.start, sub.width, normalized);

  const starLord = lordAt(starIndex).lord;
  const subLord = lordAt(sub.lordIndex).lord;
  const subSubLord = lordAt(subSub.lordIndex).lord;

  let planetHouses: number[] | undefined;
  let starLordHouses: number[] | undefined;
  let subLordHouses: number[] | undefined;
  let subSubLordHouses: number[] | undefined;

  if (ascendantSign) {
    const matchedPlanet = planetName ?? allPlanets?.find((p) => Math.abs(normalizeLongitude(p.longitude) - normalized) < 1e-3)?.planet;
    if (matchedPlanet) {
      planetHouses = getKpHouseSignifications(matchedPlanet, ascendantSign, allPlanets);
    }
    starLordHouses = getKpHouseSignifications(starLord, ascendantSign, allPlanets);
    subLordHouses = getKpHouseSignifications(subLord, ascendantSign, allPlanets);
    subSubLordHouses = getKpHouseSignifications(subSubLord, ascendantSign, allPlanets);
  }

  return {
    longitude: normalized,
    nakshatra: NAKSHATRAS[starIndex],
    nakshatraNumber,
    pada: getPada(normalized),
    starLord,
    subLord,
    subSubLord,
    planetHouses,
    starLordHouses,
    subLordHouses,
    subSubLordHouses,
  };
}

/**
 * Every KP division boundary in the zodiac.
 *
 * 27 nakshatras of 9 subs each, so 243 boundaries plus the sign changes that
 * fall between them. Exposed mainly so the divisions can be asserted against in
 * tests rather than trusted.
 */
export function listSubBoundaries(): Array<{ start: number; starLord: PlanetName; subLord: PlanetName }> {
  const boundaries: Array<{ start: number; starLord: PlanetName; subLord: PlanetName }> = [];

  for (let nakshatra = 0; nakshatra < NAKSHATRA_COUNT; nakshatra += 1) {
    let cursor = nakshatra * NAKSHATRA_ARC;

    for (let step = 0; step < VIMSHOTTARI_SEQUENCE.length; step += 1) {
      const index = nakshatra + step;
      boundaries.push({
        start: cursor,
        starLord: lordAt(nakshatra).lord,
        subLord: lordAt(index).lord,
      });
      cursor += (lordAt(index).years / VIMSHOTTARI_TOTAL_YEARS) * NAKSHATRA_ARC;
    }
  }

  return boundaries;
}
