import { SIGNS, type PlanetName, type ZodiacSign } from "@/config/astrology";
import type { KpChart, KpPlanet } from "@/lib/astrology/kp/chart";
import { PLANET_SIGN_RULERSHIPS, getSignLord } from "@/lib/astrology/kp/vimshottari";

/**
 * KP significators: which houses each planet speaks for.
 *
 * A planet in KP does not only signify the house it sits in. It speaks first
 * for its star lord's houses, then for its own - that inversion is the whole
 * point of the system, and it is why the star lord matters more than the
 * placement.
 *
 * Rahu and Ketu are the exception, and are handled at length below.
 */

/** Where a signification came from, strongest first. */
export type SignificationSource =
  | "star-lord-occupies"
  | "star-lord-owns"
  | "occupies"
  | "owns"
  | "node-conjunct"
  | "node-aspected-by"
  | "node-sign-lord";

export type Signification = {
  house: number;
  source: SignificationSource;
  /** For a node's borrowed significations, the planet it borrowed from. */
  via?: PlanetName;
};

export type NodeRelation = "conjunct" | "aspected-by" | "sign-lord";

export type NodeAgent = { planet: PlanetName; relation: NodeRelation };

export type PlanetSignificators = {
  planet: PlanetName;
  significations: Signification[];
  /** Distinct houses by the KP hierarchy, ascending. What a summary table shows. */
  houses: number[];
  /**
   * Houses that only the weaker nodal relations reach, and which the hierarchy
   * therefore excludes. Kept so a practitioner who reads the nodes cumulatively
   * can still see them.
   */
  secondaryHouses: number[];
  /** For a node, every planet it could act for, strongest relation first. */
  agents: NodeAgent[];
  /** The relation the hierarchy actually used. Null for everything but a node. */
  primaryRelation: NodeRelation | null;
};

const signNumber = (sign: ZodiacSign) => SIGNS.indexOf(sign) + 1;

/**
 * Vedic aspects, as offsets in signs.
 *
 * Every planet aspects the seventh from itself. Mars, Jupiter and Saturn have
 * their own additional aspects. The nodes are given none: KP reads what
 * aspects *them*, not what they aspect.
 */
const SPECIAL_ASPECTS: Partial<Record<PlanetName, number[]>> = {
  Mars: [3, 7],
  Jupiter: [4, 8],
  Saturn: [2, 9],
};

function aspectOffsets(planet: PlanetName): number[] {
  if (planet === "Rahu" || planet === "Ketu") return [];
  return [6, ...(SPECIAL_ASPECTS[planet] ?? [])];
}

/** Whether `from` casts a Vedic aspect onto the sign `target` sits in. */
function aspects(from: KpPlanet, target: KpPlanet): boolean {
  const fromSign = signNumber(from.sign);
  const targetSign = signNumber(target.sign);
  return aspectOffsets(from.planet).some((offset) => ((fromSign - 1 + offset) % 12) + 1 === targetSign);
}

/** Houses a planet owns, by the Placidus cusps rather than by sign. */
function ownedHouses(planet: PlanetName, chart: KpChart): number[] {
  const owned = PLANET_SIGN_RULERSHIPS[planet] ?? [];
  if (owned.length === 0) return [];

  // A house is owned when its cusp falls in a sign this planet rules. With
  // Placidus a sign can hold two cusps, or none, so this is a search rather
  // than the fixed offset a whole-sign chart would allow.
  return chart.cusps
    .filter((cusp) => owned.includes(signNumber(cusp.sign)))
    .map((cusp) => cusp.house);
}

/** The plain significations of a planet, before any nodal borrowing. */
function directSignifications(planet: KpPlanet, chart: KpChart): Signification[] {
  const starLord = chart.planets.find((candidate) => candidate.planet === planet.lords.starLord);

  const significations: Signification[] = [];

  // The star lord's houses come first. In KP they outrank the planet's own.
  if (starLord) {
    significations.push({ house: starLord.house, source: "star-lord-occupies" });
    for (const house of ownedHouses(starLord.planet, chart)) {
      significations.push({ house, source: "star-lord-owns" });
    }
  }

  significations.push({ house: planet.house, source: "occupies" });
  for (const house of ownedHouses(planet.planet, chart)) {
    significations.push({ house, source: "owns" });
  }

  return significations;
}

/**
 * The planets a node acts for.
 *
 * Rahu and Ketu own no sign and rule nothing of their own, so KP treats them
 * as agents. The classical rule from Krishnamurti is that a node gives the
 * results of, in order of strength: the planet it is conjoined with, the
 * planet that aspects it, and the lord of the sign it occupies.
 *
 * This returns all three relations, labelled and strongest first. Which of
 * them actually counts is decided in `significatorsFor`, which applies the
 * hierarchy; keeping the full list here means a practitioner who reads the
 * nodes cumulatively can still see what the hierarchy set aside.
 *
 * Conjunction is taken as sharing a sign, which is the usual KP reading.
 */
export function nodeAgents(node: KpPlanet, chart: KpChart): NodeAgent[] {
  const others = chart.planets.filter(
    (candidate) => candidate.planet !== node.planet && candidate.planet !== "Rahu" && candidate.planet !== "Ketu",
  );

  const agents: NodeAgent[] = [];

  for (const other of others) {
    if (other.sign === node.sign) agents.push({ planet: other.planet, relation: "conjunct" });
  }
  for (const other of others) {
    if (aspects(other, node) && !agents.some((agent) => agent.planet === other.planet)) {
      agents.push({ planet: other.planet, relation: "aspected-by" });
    }
  }

  const dispositor = getSignLord(signNumber(node.sign));
  if (dispositor && !agents.some((agent) => agent.planet === dispositor)) {
    agents.push({ planet: dispositor, relation: "sign-lord" });
  }

  return agents;
}

const SOURCE_FOR_RELATION = {
  conjunct: "node-conjunct",
  "aspected-by": "node-aspected-by",
  "sign-lord": "node-sign-lord",
} as const;

const RELATION_STRENGTH: NodeRelation[] = ["conjunct", "aspected-by", "sign-lord"];

/**
 * Significators for one planet, including a node's borrowed houses.
 *
 * The nodal hierarchy is applied here rather than accumulated. Krishnamurti's
 * rule reads as a hierarchy - a node gives the results of the planet it is
 * conjoined with; failing that, of the planet aspecting it; failing that, of
 * its sign lord - and taking all three instead leaves a node signifying most
 * of the chart, which says nothing. Rahu in the sample chart drops from nine
 * houses to five once the rule is applied as written.
 */
export function significatorsFor(planet: KpPlanet, chart: KpChart): PlanetSignificators {
  const significations = directSignifications(planet, chart);
  const isNode = planet.planet === "Rahu" || planet.planet === "Ketu";
  const agents = isNode ? nodeAgents(planet, chart) : [];

  // Only the strongest relation present counts.
  const primaryRelation = RELATION_STRENGTH.find((relation) =>
    agents.some((agent) => agent.relation === relation),
  ) ?? null;

  const secondary: number[] = [];

  for (const agent of agents) {
    const agentPlanet = chart.planets.find((candidate) => candidate.planet === agent.planet);
    if (!agentPlanet) continue;

    // A node borrows the agent's occupation and ownership, not the agent's own
    // star-lord significations: it stands in for the planet, it does not
    // inherit the planet's whole chain.
    const borrowed = [agentPlanet.house, ...ownedHouses(agent.planet, chart)];

    if (agent.relation === primaryRelation) {
      for (const house of borrowed) {
        significations.push({ house, source: SOURCE_FOR_RELATION[agent.relation], via: agent.planet });
      }
    } else {
      secondary.push(...borrowed);
    }
  }

  const houses = [...new Set(significations.map((entry) => entry.house))].sort((a, b) => a - b);

  return {
    planet: planet.planet,
    significations,
    houses,
    secondaryHouses: [...new Set(secondary)].filter((house) => !houses.includes(house)).sort((a, b) => a - b),
    agents,
    primaryRelation,
  };
}

/** Significators for every planet in the chart. */
export function allSignificators(chart: KpChart): PlanetSignificators[] {
  return chart.planets.map((planet) => significatorsFor(planet, chart));
}

/**
 * The four-fold significators of a house, strongest group first.
 *
 * This is the table KP actually judges a question from: planets in the star of
 * the occupants, then the occupants, then planets in the star of the owner,
 * then the owner.
 */
export function houseSignificators(
  house: number,
  chart: KpChart,
): { group: 1 | 2 | 3 | 4; description: string; planets: PlanetName[] }[] {
  const occupants = chart.planets.filter((planet) => planet.house === house);
  const owners = chart.planets.filter((planet) => ownedHouses(planet.planet, chart).includes(house));

  const inStarOf = (lords: KpPlanet[]) =>
    chart.planets
      .filter((planet) => lords.some((lord) => lord.planet === planet.lords.starLord))
      .map((planet) => planet.planet);

  return [
    { group: 1, description: "Planets in the star of an occupant", planets: inStarOf(occupants) },
    { group: 2, description: "Occupants of the house", planets: occupants.map((planet) => planet.planet) },
    { group: 3, description: "Planets in the star of the owner", planets: inStarOf(owners) },
    { group: 4, description: "Owner of the house", planets: owners.map((planet) => planet.planet) },
  ];
}
