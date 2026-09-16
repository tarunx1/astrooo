import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChartPanel } from "@/components/astrology/chart-panel";

/**
 * A layout guard for a bug that no ordinary test can see.
 *
 * A grid or flex item defaults to `min-width: auto` and so refuses to shrink
 * below its content. The chart panel holds a row of ten tabs and panels
 * containing wide tables; without `min-w-0` those contents set the card's
 * width, push the grid track past its share of the page, and the chart spills
 * under the column beside it. Nothing throws, nothing logs, and the markup is
 * otherwise perfectly correct - it only shows up on screen.
 *
 * Asserting the class is admittedly coarse, but it pins the one property whose
 * absence caused it, and names the reason in the failure message.
 */
const tabs = Array.from({ length: 10 }, (_, index) => ({
  id: `tab-${index}`,
  label: `Tab number ${index}`,
  content: <div>panel {index}</div>,
  group: index < 5 ? "First" : "Second",
}));

describe("chart panel layout", () => {
  const markup = renderToStaticMarkup(<ChartPanel tabs={tabs} />);

  it("lets the tab rows shrink below their content", () => {
    // Each banded row scrolls, which only works if it may be narrower than the
    // tabs inside it.
    const rows = markup.match(/class="flex min-w-0 items-center gap-2 overflow-x-auto"/g);
    expect(rows, "banded tab rows must carry min-w-0 or they widen the card").toHaveLength(2);
  });

  it("lets the tab panels shrink below a wide table", () => {
    expect(markup).toMatch(/role="tabpanel"/);
    expect(
      markup.match(/class="min-w-0"/g)?.length,
      "each tabpanel needs min-w-0 so a wide table cannot set the card width",
    ).toBe(tabs.length);
  });

  it("still groups the tabs into bands", () => {
    expect(markup).toContain("First");
    expect(markup).toContain("Second");
    expect(markup.match(/role="tablist"/g)).toHaveLength(2);
  });

  it("renders every tab", () => {
    for (const tab of tabs) expect(markup).toContain(tab.label);
  });
});
