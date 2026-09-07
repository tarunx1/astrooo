import { describe, expect, it } from "vitest";
import { SIGNS, type PlanetName } from "@/config/astrology";
import { normalizeDegrees } from "@/lib/astrology/engine/angles";
import { HouseSystemUnavailableError } from "@/lib/astrology/engine/houses";
import { bhavaHouseOf, computeKpChartForBirth, type KpChart, type KpPlanet } from "@/lib/astrology/kp/chart";
import { allSignificators, houseSignificators, nodeAgents, significatorsFor } from "@/lib/astrology/kp/significators";
import { getKpPosition } from "@/lib/astrology/kp/vimshottari";

/**
 * Krishnamurti Paddhati on Placidus cusps.
 *
 * KP is not a different reading of the same chart; it is a different chart.
 * The house a planet occupies, and therefore everything the system concludes,
 * depends on cusps that fall part way through a sign. These tests check that
 * the cusps are genuinely Placidus, that the Bhava Chalit placement follows
 * them rather than the signs, and that the nodes borrow from the right planets.
 */
const BIRTH = { dateOfBirth: "2001-11-27", timeOfBirth: "20:30" };
const AMRITSAR = { latitude: 31.634, longitude: 74.8723, timezone: "Asia/Kolkata" };

const chartFor = (birth = BIRTH, location = AMRITSAR) => computeKpChartForBirth(birth, location);

describe("KP chart cusps", () => {
  it("uses unequal Placidus houses, not thirty-degree blocks", () => {
    const chart = chartFor();
    const spans = chart.cusps.map((cusp, index) =>
      normalizeDegrees(chart.cusps[(index + 1) % 12].longitude - cusp.longitude),
    );

    expect(spans.reduce((total, span) => total + span, 0)).toBeCloseTo(360, 8);
    // Unequal by construction: that is what makes it a quadrant system.
    expect(Math.max(...spans) - Math.min(...spans)).toBeGreaterThan(1);
    expect(spans.every((span) => span > 0)).toBe(true);
  });

  it("keeps opposite cusps exactly opposite", () => {
    const chart = chartFor();
    for (let index = 0; index < 6; index += 1) {
      expect(normalizeDegrees(chart.cusps[index + 6].longitude - chart.cusps[index].longitude)).toBeCloseTo(180, 8);
    }
  });

  it("gives every cusp a sub lord derived from its own longitude", () => {
    // The cuspal sub lord is the value KP judges a matter by, so it has to come
    // from the cusp itself and not from the sign it happens to fall in.
    const chart = chartFor();
    expect(chart.cusps).toHaveLength(12);

    for (const cusp of chart.cusps) {
      const expected = getKpPosition(cusp.longitude);
      expect(cusp.lords.starLord, `house ${cusp.house} star`).toBe(expected.starLord);
      expect(cusp.lords.subLord, `house ${cusp.house} sub`).toBe(expected.subLord);
      expect(cusp.lords.subSubLord, `house ${cusp.house} sub-sub`).toBe(expected.subSubLord);
      expect(cusp.sign).toBe(SIGNS[Math.floor(cusp.longitude / 30)]);
    }
  });

  it("starts the first house at the ascendant, not at a sign boundary", () => {
    const chart = chartFor();
    // The whole-sign chart would put cusp one on a multiple of thirty.
    expect(chart.cusps[0].longitude % 30).not.toBeCloseTo(0, 6);
  });
});

describe("Bhava Chalit placement", () => {
  it("places planets by cusp, which moves most of them off their sign house", () => {
    const chart = chartFor();

    for (const planet of chart.planets) {
      expect(planet.house).toBe(bhavaHouseOf(planet.longitude, chart.cusps));
      expect(planet.house).toBeGreaterThanOrEqual(1);
      expect(planet.house).toBeLessThanOrEqual(12);
    }

    // This is the entire reason KP insists on Placidus. If nothing moved, the
    // chart would be reading whole-sign houses under a different name.
    const moved = chart.planets.filter((planet) => planet.house !== planet.wholeSignHouse);
    expect(moved.length).toBeGreaterThan(0);
  });

  it("keeps a planet inside the house whose cusp precedes it", () => {
    const chart = chartFor();
    for (const planet of chart.planets) {
      const cusp = chart.cusps[planet.house - 1];
      const next = chart.cusps[planet.house % 12];
      const offset = normalizeDegrees(planet.longitude - cusp.longitude);
      const span = normalizeDegrees(next.longitude - cusp.longitude);
      expect(offset, `${planet.planet}`).toBeLessThan(span);
    }
  });

  it("refuses inside the polar circles rather than inventing houses", () => {
    expect(() => chartFor(BIRTH, { latitude: 78.22, longitude: 15.63, timezone: "UTC" })).toThrow(
      HouseSystemUnavailableError,
    );
  });
});

/** A chart with planets placed exactly where a test needs them. */
function syntheticChart(placements: Partial<Record<PlanetName, number>>): KpChart {
  const cusps = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    longitude: index * 30,
    sign: SIGNS[index],
    degreeInSign: 0,
    lords: getKpPosition(index * 30),
  }));

  const planets: KpPlanet[] = (Object.entries(placements) as [PlanetName, number][]).map(
    ([planet, longitude]) => ({
      planet,
      longitude,
      sign: SIGNS[Math.floor(longitude / 30)],
      degreeInSign: longitude % 30,
      house: Math.floor(longitude / 30) + 1,
      wholeSignHouse: Math.floor(longitude / 30) + 1,
      retrograde: false,
      lords: getKpPosition(longitude),
    }),
  );

  return { instant: new Date("2001-11-27T15:00:00Z"), ayanamsa: 23.88, cusps, planets };
}

describe("Rahu and Ketu agency", () => {
  it("prefers a conjoined planet over everything else", () => {
    // Rahu and Mars both in Aries; Aries is ruled by Mars either way.
    const chart = syntheticChart({ Rahu: 5, Mars: 20, Ketu: 185 });
    const agents = nodeAgents(chart.planets.find((planet) => planet.planet === "Rahu")!, chart);

    expect(agents[0]).toEqual({ planet: "Mars", relation: "conjunct" });
    // Mars is also the sign lord, but it must not be listed twice.
    expect(agents.filter((agent) => agent.planet === "Mars")).toHaveLength(1);
  });

  it("takes an aspecting planet when nothing is conjoined", () => {
    // Saturn in Aries aspects the tenth from itself, which is Capricorn.
    const chart = syntheticChart({ Ketu: 275, Saturn: 10 });
    const agents = nodeAgents(chart.planets.find((planet) => planet.planet === "Ketu")!, chart);

    expect(agents.some((agent) => agent.planet === "Saturn" && agent.relation === "aspected-by")).toBe(true);
  });

  it("falls back to the lord of the sign the node occupies", () => {
    // Nothing conjoined and nothing aspecting: Leo's lord is the Sun.
    const chart = syntheticChart({ Rahu: 130, Sun: 15 });
    const agents = nodeAgents(chart.planets.find((planet) => planet.planet === "Rahu")!, chart);

    expect(agents.at(-1)).toEqual({ planet: "Sun", relation: "sign-lord" });
  });

  it("applies each planet's own aspects, not just the seventh", () => {
    const aspectingKetuInAries = (planet: PlanetName, longitude: number) => {
      const chart = syntheticChart({ Ketu: 10, [planet]: longitude });
      return nodeAgents(chart.planets.find((entry) => entry.planet === "Ketu")!, chart).some(
        (agent) => agent.planet === planet && agent.relation === "aspected-by",
      );
    };

    // Everything aspects the seventh: Libra to Aries.
    expect(aspectingKetuInAries("Sun", 190)).toBe(true);
    // Mars aspects the fourth and eighth, so it reaches Aries from Capricorn
    // and from Virgo. Cancer is not one of them.
    expect(aspectingKetuInAries("Mars", 280)).toBe(true);
    expect(aspectingKetuInAries("Mars", 160)).toBe(true);
    expect(aspectingKetuInAries("Mars", 100)).toBe(false);
    // Jupiter aspects the fifth and ninth: Sagittarius and Leo to Aries.
    expect(aspectingKetuInAries("Jupiter", 250)).toBe(true);
    expect(aspectingKetuInAries("Jupiter", 130)).toBe(true);
    // Saturn aspects the third and tenth: Aquarius and Cancer to Aries.
    expect(aspectingKetuInAries("Saturn", 310)).toBe(true);
    expect(aspectingKetuInAries("Saturn", 100)).toBe(true);
    // The Sun has no special aspect, so Capricorn reaches nothing in Aries.
    expect(aspectingKetuInAries("Sun", 280)).toBe(false);
  });

  it("never makes one node an agent for the other", () => {
    // Rahu and Ketu are always opposite, so a seventh-house aspect between them
    // would otherwise make each the agent of the other and say nothing.
    const chart = chartFor();
    for (const node of ["Rahu", "Ketu"] as const) {
      const agents = nodeAgents(chart.planets.find((planet) => planet.planet === node)!, chart);
      expect(agents.map((agent) => agent.planet)).not.toContain("Rahu");
      expect(agents.map((agent) => agent.planet)).not.toContain("Ketu");
    }
  });

  it("counts only the strongest relation, not all three", () => {
    // Rahu in Aries with Mars conjoined and Jupiter aspecting from Sagittarius.
    // Mars wins, and Jupiter's houses must not be folded in as well.
    const chart = syntheticChart({ Rahu: 5, Mars: 20, Jupiter: 250, Ketu: 185, Sun: 100 });
    const rahu = significatorsFor(chart.planets.find((planet) => planet.planet === "Rahu")!, chart);

    expect(rahu.primaryRelation).toBe("conjunct");
    // Every borrowed house is attributed to Mars, and none to Jupiter.
    const borrowed = rahu.significations.filter((entry) => entry.source.startsWith("node-"));
    expect(borrowed.length).toBeGreaterThan(0);
    expect(new Set(borrowed.map((entry) => entry.via))).toEqual(new Set(["Mars"]));

    // Jupiter is still listed as an available agent, and what it would have
    // added is kept separately rather than thrown away.
    expect(rahu.agents.some((agent) => agent.planet === "Jupiter")).toBe(true);
    expect(rahu.secondaryHouses.length).toBeGreaterThan(0);
    for (const house of rahu.secondaryHouses) expect(rahu.houses).not.toContain(house);
  });

  it("falls through the hierarchy when the stronger relation is absent", () => {
    // Nothing conjoined, so the aspecting planet is what counts.
    const aspected = syntheticChart({ Ketu: 275, Saturn: 10 });
    const ketu = significatorsFor(aspected.planets.find((planet) => planet.planet === "Ketu")!, aspected);
    expect(ketu.primaryRelation).toBe("aspected-by");

    // Nothing conjoined and nothing aspecting: the sign lord carries it.
    const alone = syntheticChart({ Rahu: 130, Sun: 15 });
    const rahu = significatorsFor(alone.planets.find((planet) => planet.planet === "Rahu")!, alone);
    expect(rahu.primaryRelation).toBe("sign-lord");
    expect(rahu.significations.some((entry) => entry.source === "node-sign-lord")).toBe(true);
  });

  it("gives a non-node no relation and no secondary houses", () => {
    const chart = chartFor();
    for (const planet of chart.planets.filter((entry) => entry.planet !== "Rahu" && entry.planet !== "Ketu")) {
      const result = significatorsFor(planet, chart);
      expect(result.primaryRelation, planet.planet).toBeNull();
      expect(result.agents, planet.planet).toHaveLength(0);
      expect(result.secondaryHouses, planet.planet).toHaveLength(0);
    }
  });

  it("labels where every borrowed house came from", () => {
    const chart = chartFor();
    const rahu = significatorsFor(chart.planets.find((planet) => planet.planet === "Rahu")!, chart);

    expect(rahu.agents.length).toBeGreaterThan(0);
    const borrowed = rahu.significations.filter((entry) => entry.source.startsWith("node-"));
    expect(borrowed.length).toBeGreaterThan(0);
    // A borrowed house without an attributed planet is unreadable.
    for (const entry of borrowed) expect(entry.via).toBeTruthy();
  });
});

describe("KP significators", () => {
  it("gives every planet its star lord's houses before its own", () => {
    const chart = chartFor();
    for (const planet of chart.planets) {
      const result = significatorsFor(planet, chart);
      const sources = result.significations.map((entry) => entry.source);

      expect(result.houses.length).toBeGreaterThan(0);
      expect(result.houses.every((house) => house >= 1 && house <= 12)).toBe(true);
      expect(sources).toContain("occupies");

      const starLordIndex = sources.findIndex((source) => source.startsWith("star-lord"));
      const ownIndex = sources.indexOf("occupies");
      if (starLordIndex >= 0) expect(starLordIndex).toBeLessThan(ownIndex);
    }
  });

  it("owns a house by which sign its cusp falls in", () => {
    const chart = chartFor();
    const sun = significatorsFor(chart.planets.find((planet) => planet.planet === "Sun")!, chart);
    const leoCusps = chart.cusps.filter((cusp) => cusp.sign === "Leo").map((cusp) => cusp.house);

    for (const house of leoCusps) {
      expect(sun.significations.some((entry) => entry.house === house && entry.source === "owns")).toBe(true);
    }
  });

  it("gives the nodes no ownership of their own", () => {
    const chart = chartFor();
    for (const node of ["Rahu", "Ketu"] as const) {
      const result = significatorsFor(chart.planets.find((planet) => planet.planet === node)!, chart);
      expect(result.significations.some((entry) => entry.source === "owns")).toBe(false);
    }
  });

  it("returns the four-fold significators of a house in order of strength", () => {
    const chart = chartFor();
    for (let house = 1; house <= 12; house += 1) {
      const groups = houseSignificators(house, chart);
      expect(groups.map((group) => group.group)).toEqual([1, 2, 3, 4]);
      for (const group of groups) {
        expect(new Set(group.planets).size, `house ${house} group ${group.group}`).toBe(group.planets.length);
      }
    }
  });

  it("covers all nine planets", () => {
    expect(allSignificators(chartFor())).toHaveLength(9);
  });
});
