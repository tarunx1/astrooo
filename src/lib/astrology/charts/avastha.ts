import type { PlanetName } from "@/config/astrology";
import { getDegreeInSign, getSignNumber } from "@/lib/astrology/charts/signs";

/**
 * Baaladi avastha: a planet's age within its sign.
 *
 * The sign is cut into five equal parts of six degrees and the planet is called
 * infant, adolescent, adult, old or dead according to which it falls in. In an
 * **odd** sign the sequence runs forward from infancy; in an **even** sign it
 * runs backwards, so a planet at the start of an even sign is already dead and
 * one at the end is newborn.
 *
 * That reversal is the whole subtlety, and it is why this cannot be written as
 * a single division. Software that forgets it reports exactly the wrong avastha
 * for half of all placements, and the result still looks entirely reasonable.
 *
 * Only the Baaladi states are calculated. Deeptaadi (the twenty states from
 * dignity and aspect) and the Jagradi triad are not implemented; the rules for
 * combining them vary and a partial set would be worse than none. The names are
 * positions in a cycle - `Mrita` means the last sixth of the sign, not that
 * anything is dead.
 */

export const BAALADI_AVASTHAS = ["Baala", "Kumara", "Yuva", "Vriddha", "Mrita"] as const;

export type BaaladiAvastha = (typeof BAALADI_AVASTHAS)[number];

/** Width of one avastha: a sign in five parts. */
const AVASTHA_ARC = 6;

/**
 * The avastha a longitude falls in.
 *
 * The nodes are excluded: they are shadow points rather than bodies with an
 * age, and no classical source assigns them a baaladi state.
 */
export function avasthaOf(planet: PlanetName, longitude: number): BaaladiAvastha | null {
  if (planet === "Rahu" || planet === "Ketu") return null;

  const sign = getSignNumber(longitude);
  const degree = getDegreeInSign(longitude);

  const raw = degree / AVASTHA_ARC;
  const snapped = Math.abs(raw - Math.round(raw)) < 1e-9 ? Math.round(raw) : raw;
  const index = Math.min(4, Math.max(0, Math.floor(snapped)));

  // Even signs run the sequence in reverse.
  return BAALADI_AVASTHAS[sign % 2 === 1 ? index : 4 - index];
}
