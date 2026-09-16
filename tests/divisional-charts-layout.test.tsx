import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DivisionalCharts } from "@/components/astrology/divisional-charts";
import {
  createDivisionalChart,
  createRashiChart,
  createShodashvarga,
} from "@/lib/astrology/charts/factory";
import { VARGA_DEFINITIONS } from "@/lib/astrology/charts/varga";

/**
 * A layout guard for the division chips.
 *
 * The chips row used to be `flex w-max` inside an `overflow-x-auto` wrapper.
 * `width: max-content` makes the row's min-content contribution its own full
 * width, so the grid item above it was sized to all sixteen chips on one line,
 * the chart card grew with it, and the card covered the dasha tables in the
 * column beside it. Measured in Chrome, that row forced a 442px column to
 * 880px. The wrapper could not save it: a grid item is sized from the wrapper's
 * *content*, before the wrapper gets a chance to scroll it.
 *
 * Asserting classes is coarse, but it pins the two properties whose absence
 * caused it and names the reason in the failure message.
 */
const chart = createRashiChart({
  ascendant: { sign: "Aries", degree: 12.5 },
  planets: [
    { planet: "Sun", longitude: 9.5, retrograde: false },
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

const charts = VARGA_DEFINITIONS.map(({ division, name, significance }) => ({
  division,
  name,
  significance,
  data: createDivisionalChart(chart, division),
}));

describe("divisional chart chips", () => {
  const markup = renderToStaticMarkup(
    <DivisionalCharts charts={charts} table={createShodashvarga(chart)} />,
  );

  it("renders a chip for every division", () => {
    expect(charts.length).toBeGreaterThan(10);
    for (const entry of charts) expect(markup).toContain(`>D${entry.division}</button>`);
  });

  it("wraps the chips instead of laying them out on one max-content line", () => {
    expect(markup).toContain("flex flex-wrap gap-2");
    expect(
      markup,
      "w-max makes the row's min-content its full width, which widens the column and covers the tables beside it",
    ).not.toContain("w-max");
  });

  it("lets every wrapper shrink below the chips and the Shodashvarga table", () => {
    // Each is a grid item, and a grid item defaults to min-width:auto.
    expect(markup).toContain('class="grid min-w-0 gap-6"');
    expect(markup).toContain('class="min-w-0"');
    expect(
      markup,
      "the Shodashvarga wrapper holds a 42rem table and must be allowed to be narrower than it",
    ).toContain('class="grid min-w-0 gap-2"');
  });
});
