import type { PlanetName } from "@/config/astrology";
import { normalizeSign } from "@/lib/astrology/charts/signs";
import { ChartDataError, type VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Planetary friendship: natural, temporal, and the two combined.
 *
 * Natural friendship is a constant of the system - it never varies from chart
 * to chart. Temporal friendship is the opposite: it depends entirely on where
 * two planets happen to sit relative to each other in this chart. The compound
 * relationship is what an astrologer actually reads, and it is the pair taken
 * together, which is why all three are returned rather than only the last.
 *
 * Rahu and Ketu are excluded. The classical naisargika maitri table is built on
 * the seven planets, and the readings given for the nodes vary by author - so
 * offering one would be presenting a choice as though it were the tradition.
 * The same restriction applies in `ashtakavarga.ts`, for the same reason.
 */

export const RELATIONSHIP_PLANETS = [
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
] as const;

export type RelationshipPlanet = (typeof RELATIONSHIP_PLANETS)[number];

export type NaturalRelation = "friend" | "neutral" | "enemy";
export type TemporalRelation = "friend" | "enemy";
export type CompoundRelation =
  | "great friend"
  | "friend"
  | "neutral"
  | "enemy"
  | "great enemy";

/**
 * Natural relationships (naisargika maitri).
 *
 * Only friends and enemies are listed; every planet not named is neutral. Note
 * the Moon has no natural enemies, which is a property of the tradition and not
 * an omission here.
 */
const NATURAL: Record<RelationshipPlanet, { friends: RelationshipPlanet[]; enemies: RelationshipPlanet[] }> = {
  Sun: { friends: ["Moon", "Mars", "Jupiter"], enemies: ["Venus", "Saturn"] },
  Moon: { friends: ["Sun", "Mercury"], enemies: [] },
  Mars: { friends: ["Sun", "Moon", "Jupiter"], enemies: ["Mercury"] },
  Mercury: { friends: ["Sun", "Venus"], enemies: ["Moon"] },
  Jupiter: { friends: ["Sun", "Moon", "Mars"], enemies: ["Mercury", "Venus"] },
  Venus: { friends: ["Mercury", "Saturn"], enemies: ["Sun", "Moon"] },
  Saturn: { friends: ["Mercury", "Venus"], enemies: ["Sun", "Moon", "Mars"] },
};

/** Houses from a planet whose occupants are its temporal friends. */
const TEMPORAL_FRIEND_HOUSES = [2, 3, 4, 10, 11, 12];

export function naturalRelation(from: RelationshipPlanet, to: RelationshipPlanet): NaturalRelation {
  if (from === to) return "friend";
  if (NATURAL[from].friends.includes(to)) return "friend";
  if (NATURAL[from].enemies.includes(to)) return "enemy";
  return "neutral";
}

/**
 * Temporal relationship (tatkalika maitri).
 *
 * A planet in the 2nd, 3rd, 4th, 10th, 11th or 12th from another is its
 * temporal friend; the rest are temporal enemies. There is no temporal neutral
 * - the division is exhaustive, which is why the return type has two values
 * and not three.
 */
export function temporalRelation(fromSign: number, toSign: number): TemporalRelation {
  const house = ((normalizeSign(toSign) - normalizeSign(fromSign) + 12) % 12) + 1;
  return TEMPORAL_FRIEND_HOUSES.includes(house) ? "friend" : "enemy";
}

/**
 * Compound relationship (panchadha maitri): the five-fold scale.
 *
 * Natural and temporal are added rather than one overriding the other, so a
 * natural enemy sitting in a temporally friendly place comes out neutral - not
 * a friend, and no longer an enemy.
 */
export function compoundRelation(
  natural: NaturalRelation,
  temporal: TemporalRelation,
): CompoundRelation {
  if (natural === "friend") return temporal === "friend" ? "great friend" : "neutral";
  if (natural === "neutral") return temporal === "friend" ? "friend" : "enemy";
  return temporal === "friend" ? "neutral" : "great enemy";
}

export type RelationshipCell = {
  from: RelationshipPlanet;
  to: RelationshipPlanet;
  natural: NaturalRelation;
  temporal: TemporalRelation;
  compound: CompoundRelation;
};

/**
 * The full planet x planet matrix for one chart.
 *
 * Asymmetric by nature: Venus is a natural enemy of the Sun while the Sun is a
 * natural enemy of Venus, but temporal relations depend on which planet is
 * being counted from, so the two halves of the table are not mirror images.
 */
export function calculateRelationships(chart: VedicChartData): RelationshipCell[] {
  const signs = {} as Record<RelationshipPlanet, number>;

  for (const planet of RELATIONSHIP_PLANETS) {
    const found = chart.planets.find((entry) => entry.planet === (planet as PlanetName));
    if (!found) throw new ChartDataError(`A friendship table needs ${planet}'s position.`);
    signs[planet] = normalizeSign(found.sign);
  }

  const cells: RelationshipCell[] = [];

  for (const from of RELATIONSHIP_PLANETS) {
    for (const to of RELATIONSHIP_PLANETS) {
      if (from === to) continue;

      const natural = naturalRelation(from, to);
      const temporal = temporalRelation(signs[from], signs[to]);
      cells.push({ from, to, natural, temporal, compound: compoundRelation(natural, temporal) });
    }
  }

  return cells;
}
