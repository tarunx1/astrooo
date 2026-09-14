import type { PlanetName } from "@/config/astrology";
import { getDegreeInSign, getSignNumber, normalizeLongitude, normalizeSign } from "@/lib/astrology/charts/signs";
import { naturalRelation, RELATIONSHIP_PLANETS, type RelationshipPlanet } from "@/lib/astrology/charts/relationships";
import { getSignLord } from "@/lib/astrology/kp/vimshottari";
import { avasthaOf, type BaaladiAvastha } from "@/lib/astrology/charts/avastha";
import { calculateBeneficNatures, type Benefic } from "@/lib/astrology/charts/benefic";
import type { VedicChartData } from "@/lib/astrology/charts/types";

/**
 * Dignity and combustion: a planet's standing where it sits.
 *
 * These are the structured attributes an interpretation layer reads. Nothing
 * here judges - "debilitated" is a position, not a verdict, and no favourable
 * or unfavourable flag is produced. The tradition has a great deal to say about
 * what a debilitated planet means and none of it belongs in a calculation.
 *
 * Exaltation is reported at two strengths: the sign, and whether the planet is
 * at its exact exaltation degree. Software that reports only the sign loses the
 * distinction the tradition draws between exalted and deeply exalted.
 */

export type Dignity =
  | "exalted"
  | "moolatrikona"
  | "own sign"
  | "friend's sign"
  | "neutral sign"
  | "enemy's sign"
  | "debilitated";

/** Exact exaltation points. Debilitation is the same degree of the 7th sign. */
const EXALTATION: Record<RelationshipPlanet, { sign: number; degree: number }> = {
  Sun: { sign: 1, degree: 10 }, // Aries 10
  Moon: { sign: 2, degree: 3 }, // Taurus 3
  Mars: { sign: 10, degree: 28 }, // Capricorn 28
  Mercury: { sign: 6, degree: 15 }, // Virgo 15
  Jupiter: { sign: 4, degree: 5 }, // Cancer 5
  Venus: { sign: 12, degree: 27 }, // Pisces 27
  Saturn: { sign: 7, degree: 20 }, // Libra 20
};

/** Moolatrikona: a sign and the arc within it. */
const MOOLATRIKONA: Record<RelationshipPlanet, { sign: number; from: number; to: number }> = {
  Sun: { sign: 5, from: 0, to: 20 }, // Leo 0-20
  Moon: { sign: 2, from: 4, to: 30 }, // Taurus 4-30
  Mars: { sign: 1, from: 0, to: 12 }, // Aries 0-12
  Mercury: { sign: 6, from: 16, to: 20 }, // Virgo 16-20
  Jupiter: { sign: 9, from: 0, to: 10 }, // Sagittarius 0-10
  Venus: { sign: 7, from: 0, to: 15 }, // Libra 0-15
  Saturn: { sign: 11, from: 0, to: 20 }, // Aquarius 0-20
};

/**
 * Combustion orbs, in degrees from the Sun.
 *
 * Mercury and Venus take a tighter orb when retrograde, which is the one place
 * the tradition makes combustion depend on motion as well as distance.
 */
const COMBUSTION_ORB: Record<string, { direct: number; retrograde?: number }> = {
  Moon: { direct: 12 },
  Mars: { direct: 17 },
  Mercury: { direct: 14, retrograde: 12 },
  Jupiter: { direct: 11 },
  Venus: { direct: 10, retrograde: 8 },
  Saturn: { direct: 15 },
};

const isRelationshipPlanet = (planet: PlanetName): planet is RelationshipPlanet =>
  (RELATIONSHIP_PLANETS as readonly string[]).includes(planet);

/** The sign opposite a given one. */
const opposite = (sign: number) => normalizeSign(sign + 6);

export function debilitationOf(planet: RelationshipPlanet): { sign: number; degree: number } {
  const exalted = EXALTATION[planet];
  return { sign: opposite(exalted.sign), degree: exalted.degree };
}

/**
 * A planet's dignity from its longitude alone.
 *
 * Order matters: exaltation and debilitation outrank moolatrikona, which
 * outranks own sign, which outranks a relationship with the sign's lord. A
 * planet in its own sign is never reported as being in a friend's sign, even
 * though it is trivially friendly with itself.
 */
export function dignityOf(planet: PlanetName, longitude: number): Dignity | null {
  if (!isRelationshipPlanet(planet)) return null; // Nodes own no sign.

  const sign = getSignNumber(longitude);
  const degree = getDegreeInSign(longitude);

  const exalted = EXALTATION[planet];
  if (sign === exalted.sign) return "exalted";
  if (sign === opposite(exalted.sign)) return "debilitated";

  const moola = MOOLATRIKONA[planet];
  if (sign === moola.sign && degree >= moola.from && degree < moola.to) return "moolatrikona";

  const lord = getSignLord(sign);
  if (lord === planet) return "own sign";

  if (!isRelationshipPlanet(lord)) return "neutral sign";

  const relation = naturalRelation(planet, lord);
  if (relation === "friend") return "friend's sign";
  if (relation === "enemy") return "enemy's sign";
  return "neutral sign";
}

/** True when the planet sits at its exact exaltation or debilitation degree. */
export function isDeeply(planet: PlanetName, longitude: number, tolerance = 1): boolean {
  if (!isRelationshipPlanet(planet)) return false;

  const sign = getSignNumber(longitude);
  const degree = getDegreeInSign(longitude);
  const exalted = EXALTATION[planet];

  if (sign === exalted.sign) return Math.abs(degree - exalted.degree) <= tolerance;
  if (sign === opposite(exalted.sign)) return Math.abs(degree - exalted.degree) <= tolerance;
  return false;
}

/**
 * Combustion: too close to the Sun to be seen.
 *
 * Measured as the shorter arc between the two longitudes, so a planet just
 * ahead of the Sun and one just behind are treated alike. The Sun itself is
 * never combust, and the nodes have no orb in the tradition.
 */
export function isCombust(
  planet: PlanetName,
  longitude: number,
  sunLongitude: number,
  retrograde = false,
): boolean {
  const orb = COMBUSTION_ORB[planet];
  if (!orb) return false;

  const separation = Math.abs(normalizeLongitude(longitude - sunLongitude));
  const shorter = Math.min(separation, 360 - separation);
  const limit = retrograde && orb.retrograde != null ? orb.retrograde : orb.direct;

  return shorter <= limit;
}

export type PlanetaryCondition = {
  planet: PlanetName;
  sign: number;
  degreeInSign: number;
  signLord: PlanetName;
  dignity: Dignity | null;
  /** Baaladi avastha: the planet's age within its sign. Null for the nodes. */
  avastha: BaaladiAvastha | null;
  /** Natural benefic or malefic, with the Moon and Mercury judged in context. */
  nature: Benefic;
  /** True where that verdict came from the chart rather than a fixed table. */
  natureConditional: boolean;
  /** At the exact exaltation or debilitation degree. */
  deep: boolean;
  combust: boolean;
  retrograde: boolean;
};

/** Every planet's standing in one chart. */
export function calculateConditions(chart: VedicChartData): PlanetaryCondition[] {
  const sun = chart.planets.find((planet) => planet.planet === "Sun");
  const natures = new Map(calculateBeneficNatures(chart).map((entry) => [entry.planet, entry]));

  return chart.planets.map((planet) => ({
    planet: planet.planet,
    sign: normalizeSign(planet.sign),
    degreeInSign: planet.degreeInSign,
    signLord: getSignLord(planet.sign),
    dignity: dignityOf(planet.planet, planet.longitude),
    avastha: avasthaOf(planet.planet, planet.longitude),
    nature: natures.get(planet.planet)?.nature ?? "malefic",
    natureConditional: natures.get(planet.planet)?.conditional ?? false,
    deep: isDeeply(planet.planet, planet.longitude),
    combust:
      planet.planet !== "Sun" && sun
        ? isCombust(planet.planet, planet.longitude, sun.longitude, planet.retrograde)
        : false,
    retrograde: planet.retrograde,
  }));
}
