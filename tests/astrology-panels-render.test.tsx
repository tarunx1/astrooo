import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AshtakavargaPanel } from "@/components/astrology/ashtakavarga-panel";
import { RelationshipsPanel } from "@/components/astrology/relationships-panel";
import { createRashiChart } from "@/lib/astrology/charts/factory";

/**
 * The new panels, actually rendered.
 *
 * A typecheck proves the props line up; it does not prove a component produces
 * anything. These render to markup and look for values that can only be there
 * if the calculation ran - a bindu total, a dignity, a friendship cell.
 */
const chart = createRashiChart({
  ascendant: { sign: "Aries", degree: 12.5 },
  planets: [
    { planet: "Sun", longitude: 9.5, retrograde: false }, // Aries: exalted
    { planet: "Moon", longitude: 33, retrograde: false },
    { planet: "Mars", longitude: 201.75, retrograde: false },
    { planet: "Mercury", longitude: 13.2, retrograde: true },
    { planet: "Jupiter", longitude: 276.3, retrograde: false },
    { planet: "Venus", longitude: 44.8, retrograde: false },
    { planet: "Saturn", longitude: 310.05, retrograde: true },
    { planet: "Rahu", longitude: 95.2, retrograde: true },
    { planet: "Ketu", longitude: 275.2, retrograde: true },
  ],
});

describe("Ashtakavarga panel", () => {
  const markup = renderToStaticMarkup(<AshtakavargaPanel chart={chart} />);

  it("renders both tables", () => {
    expect(markup).toContain("Sarvashtakavarga");
    expect(markup).toContain("Bhinnashtakavarga");
  });

  it("shows the calculated totals rather than placeholders", () => {
    expect(markup).toContain("337");
    // Jupiter's sheet always totals 56.
    expect(markup).toContain("56");
  });

  it("says plainly that the nodes hold no sheet", () => {
    expect(markup).toContain("Rahu and Ketu");
  });
});

describe("Relationships panel", () => {
  const markup = renderToStaticMarkup(<RelationshipsPanel chart={chart} />);

  it("renders the condition table and the matrix", () => {
    expect(markup).toContain("Planetary condition");
    expect(markup).toContain("Friendship");
  });

  it("reports a dignity that the chart actually produces", () => {
    // The Sun at 9.5 Aries is exalted, and within a degree of the exact point.
    expect(markup).toContain("exalted");
    expect(markup).toContain("(exact)");
  });

  it("marks a retrograde planet", () => {
    expect(markup).toContain("Retrograde");
  });

  it("renders friendship cells with the five-fold abbreviations", () => {
    expect(markup).toMatch(/>(GF|F|N|E|GE)</);
    expect(markup).toContain("great friend");
  });

  it("says the nodes are not in the friendship table", () => {
    expect(markup).toContain("Rahu and Ketu are not in the classical friendship table");
  });
});
