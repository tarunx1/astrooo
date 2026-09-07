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
  } = {},
): HouseLabelLayout {
  const count = planets.length;
  if (count === 0) return { labels: [], fontSize: 34 };

  // Degrees make each label roughly twice as wide, so they force a single
  // column and a smaller size much sooner.
  const showDegrees = options.showDegrees ?? false;
  const columns = showDegrees ? 1 : count > 4 ? 2 : 1;

  const fontSize = showDegrees
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

  const lineHeight = fontSize * 1.18;
  const rows = Math.ceil(count / columns);
  // Centred on the anchor, then pushed down if it would rise into the sign
  // label. A crowded house grows downward into open space rather than upward
  // into the number that names it.
  const centred = anchor.y - ((rows - 1) * lineHeight) / 2;
  const top = options.minTop === undefined ? centred : Math.max(centred, options.minTop);
  const columnGap = fontSize * 2.6;

  const labels = planets.map((planet, index) => {
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

  return { labels, fontSize };
}
