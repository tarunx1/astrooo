import type { PlanetName } from "@/config/astrology";
import { formatDegreeInSign } from "@/lib/astrology/charts/signs";
import type { ChartPlanet } from "@/lib/astrology/charts/types";

/**
 * Planet labels and how they arrange inside a house.
 *
 * A house can hold anything from nothing to all nine grahas, and the whole
 * chart is unreadable if labels overlap. The arrangement is computed here as
 * plain numbers rather than left to the browser, so the same chart lays out
 * identically on a server render, in a PDF and in a test.
 */
export const PLANET_ABBREVIATIONS: Record<PlanetName, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

export type PlanetLabelMode = "short" | "full";

export function planetLabel(
  planet: ChartPlanet,
  options: { mode?: PlanetLabelMode; showDegrees?: boolean; showRetrograde?: boolean } = {},
): string {
  const { mode = "short", showDegrees = false, showRetrograde = true } = options;

  const name = mode === "full" ? planet.planet : PLANET_ABBREVIATIONS[planet.planet];
  const degree = showDegrees ? ` ${formatDegreeInSign(planet.degreeInSign)}` : "";
  // A trailing R is the conventional mark and survives any font, where a
  // superscript glyph may not.
  const retrograde = showRetrograde && planet.retrograde ? " R" : "";

  return `${name}${degree}${retrograde}`;
}

/**
 * Half a label's width, in the chart's own units.
 *
 * SVG text cannot be measured before it is drawn, and the chart has to lay out
 * identically on a server, in a PDF and in a test, so the width is estimated
 * from the character count. The ratio is deliberately generous: over-estimating
 * costs a slightly smaller font, under-estimating puts a planet in the wrong
 * house's shape, which is the error a reader cannot see is an error.
 */
const AVERAGE_GLYPH_ADVANCE = 0.58;

export function estimateLabelHalfWidth(text: string, fontSize: number): number {
  return (text.length * AVERAGE_GLYPH_ADVANCE * fontSize) / 2;
}

/** Below this the type is no longer worth reading, so the block stops shrinking. */
const MIN_FONT_SIZE = 11;

export type PlacedLabel = { planet: ChartPlanet; x: number; y: number; text: string };

export type HouseLabelLayout = {
  labels: PlacedLabel[];
  /** Font size for this house, reduced as it fills up. */
  fontSize: number;
};

/**
 * Arranges a house's planets around its anchor.
 *
 * Up to four sit in a single column; beyond that they split into two columns so
 * a crowded house grows sideways instead of running out of the shape. Type size
 * steps down as the count rises. Both thresholds are chosen so that nine
 * planets - the most possible - still fit inside the smallest house of the
 * layout.
 *
 * The count is not the whole story once degrees are shown: a label carrying a
 * degree is about twice as wide, and a corner triangle narrows to nothing at
 * its apex. Where the caller supplies `fitWidth`, the size chosen from the
 * count is treated as a preference and reduced until the block is inside the
 * shape it is drawn in.
 */
export function layoutPlanetsInHouse(
  planets: readonly ChartPlanet[],
  anchor: { x: number; y: number },
  options: {
    mode?: PlanetLabelMode;
    showDegrees?: boolean;
    showRetrograde?: boolean;
    /** Block is pushed down so nothing sits above this line, e.g. a sign label. */
    minTop?: number;
    /**
     * How far the house extends either side of the anchor at a given height.
     *
     * Supplied by the layout that owns the geometry. Without it the block is
     * sized from the planet count alone, which is fine for short labels and not
     * fine for a corner triangle that has narrowed to nothing by the third row.
     */
    fitWidth?: (y: number) => number;
  } = {},
): HouseLabelLayout {
  const count = planets.length;
  if (count === 0) return { labels: [], fontSize: 34 };

  // Degrees make each label roughly twice as wide, so they force a single
  // column and a smaller size much sooner.
  const showDegrees = options.showDegrees ?? false;
  const columns = showDegrees ? 1 : count > 4 ? 2 : 1;

  const preferredFontSize = showDegrees
    ? count <= 2
      ? 30
      : count <= 4
        ? 24
        : 19
    : count <= 3
      ? 34
      : count <= 5
        ? 29
        : count <= 7
          ? 25
          : 22;

  const place = (fontSize: number): PlacedLabel[] => {
    const lineHeight = fontSize * 1.18;
    const rows = Math.ceil(count / columns);
    // Centred on the anchor, then pushed down if it would rise into the sign
    // label. A crowded house grows downward into open space rather than upward
    // into the number that names it.
    const centred = anchor.y - ((rows - 1) * lineHeight) / 2;
    const top = options.minTop === undefined ? centred : Math.max(centred, options.minTop);
    const columnGap = fontSize * 2.6;

    return planets.map((planet, index) => {
      const column = columns === 1 ? 0 : index % columns;
      const row = columns === 1 ? index : Math.floor(index / columns);

      // With two columns and an odd final row, centre the last label.
      const isLoneLast = columns === 2 && index === count - 1 && count % 2 === 1;
      const offsetX = isLoneLast ? 0 : (column - (columns - 1) / 2) * columnGap;

      return {
        planet,
        x: anchor.x + offsetX,
        y: top + row * lineHeight,
        text: planetLabel(planet, options),
      };
    });
  };

  /**
   * Shrinks until the whole block is inside the shape.
   *
   * A smaller font is both narrower and shorter, so the block also moves up out
   * of the narrow end of a triangle - which is why one dimension of search is
   * enough. Stops at the legibility floor rather than shrinking without limit:
   * past that point neither outcome is readable, and the caller is better told
   * by an overflowing chart than by a row of specks.
   */
  const fits = (fontSize: number): boolean => {
    const available = options.fitWidth;
    if (!available) return true;

    return place(fontSize).every((label) => {
      const reach = Math.abs(label.x - anchor.x) + estimateLabelHalfWidth(label.text, fontSize);
      const top = label.y - fontSize * 0.72;
      const bottom = label.y + fontSize * 0.22;
      return reach <= available(top) && reach <= available(bottom);
    });
  };

  let fontSize = preferredFontSize;
  while (fontSize > MIN_FONT_SIZE && !fits(fontSize)) {
    fontSize -= 1;
  }

  const labels = place(fontSize);

  return { labels, fontSize };
}
