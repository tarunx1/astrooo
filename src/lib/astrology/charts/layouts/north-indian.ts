/**
 * North Indian chart geometry.
 *
 * A square crossed by both diagonals with a diamond joining the edge midpoints,
 * giving four kite-shaped houses at the centre edges and eight triangles around
 * them.
 *
 * The defining rule of this style: **house positions are fixed and the signs
 * rotate through them.** House 1 is always the upper kite whatever the
 * ascendant. Rotating the houses instead is the classic way to draw a chart
 * that looks right and means something entirely different.
 *
 * Houses run anticlockwise from the top, which is the traditional order.
 *
 * Coordinates are in a 1000x1000 viewBox and are anchor centres: labels are
 * drawn with `text-anchor: middle` around them, so nothing depends on measuring
 * rendered text.
 */
export const NORTH_INDIAN_VIEWBOX = 1000;

export type HouseAnchor = { house: number; x: number; y: number };

export const NORTH_INDIAN_HOUSE_ANCHORS: readonly HouseAnchor[] = [
  { house: 1, x: 500, y: 210 }, // top kite
  { house: 2, x: 250, y: 105 }, // top-left triangle
  { house: 3, x: 105, y: 250 }, // left-top triangle
  { house: 4, x: 250, y: 500 }, // left kite
  { house: 5, x: 105, y: 750 }, // left-bottom triangle
  { house: 6, x: 250, y: 895 }, // bottom-left triangle
  { house: 7, x: 500, y: 790 }, // bottom kite
  { house: 8, x: 750, y: 895 }, // bottom-right triangle
  { house: 9, x: 895, y: 750 }, // right-bottom triangle
  { house: 10, x: 750, y: 500 }, // right kite
  { house: 11, x: 895, y: 250 }, // right-top triangle
  { house: 12, x: 750, y: 105 }, // top-right triangle
] as const;

/** The frame: outer square, both diagonals, and the inner diamond. */
export const NORTH_INDIAN_PATHS = {
  border: "M0 0 H1000 V1000 H0 Z",
  diagonals: "M0 0 L1000 1000 M1000 0 L0 1000",
  diamond: "M500 0 L1000 500 L500 1000 L0 500 Z",
} as const;

/** Minimum gap between the sign number and the nearest planet label. */
export const SIGN_CLEARANCE = 38;

/**
 * Where a house's sign number sits.
 *
 * Fixed per house, near the outer edge of the shape where there is room. The
 * planet block is then pushed down to clear it rather than the sign being
 * moved to dodge the planets, because the sign has the tighter constraint: at
 * the corners it is already close to the frame and has nowhere to go.
 */
export function signAnchorFor(anchor: HouseAnchor): { x: number; y: number } {
  const isKite = anchor.house === 1 || anchor.house === 4 || anchor.house === 7 || anchor.house === 10;
  return { x: anchor.x, y: anchor.y - (isKite ? 72 : 54) };
}

/**
 * The actual shape of each house.
 *
 * The four kites at the edge midpoints and eight triangles in the corners,
 * as vertices in the same 1000x1000 space. Anchors alone are enough to place a
 * short label, but not to know whether a long one still fits: a corner triangle
 * is 500 units across at its base and nothing at all at its apex.
 */
export const NORTH_INDIAN_HOUSE_POLYGONS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[500, 0], [750, 250], [500, 500], [250, 250]],
  2: [[0, 0], [500, 0], [250, 250]],
  3: [[0, 0], [250, 250], [0, 500]],
  4: [[0, 500], [250, 250], [500, 500], [250, 750]],
  5: [[0, 500], [250, 750], [0, 1000]],
  6: [[0, 1000], [500, 1000], [250, 750]],
  7: [[500, 500], [750, 750], [500, 1000], [250, 750]],
  8: [[500, 1000], [1000, 1000], [750, 750]],
  9: [[1000, 500], [1000, 1000], [750, 750]],
  10: [[1000, 500], [750, 250], [500, 500], [750, 750]],
  11: [[1000, 0], [1000, 500], [750, 250]],
  12: [[500, 0], [1000, 0], [750, 250]],
};

/**
 * How far a label centred on the house's axis may extend at a given height.
 *
 * Returns the distance to the *nearer* of the two edges, so a label centred on
 * the anchor is symmetric and cannot lean out of the shape on one side. Rows
 * outside the polygon get zero, which is what makes an oversized block shrink
 * rather than spill.
 */
export function houseHalfWidthAt(house: number, y: number): number {
  const polygon = NORTH_INDIAN_HOUSE_POLYGONS[house];
  const anchor = NORTH_INDIAN_HOUSE_ANCHORS.find((candidate) => candidate.house === house);
  if (!polygon || !anchor) return 0;

  // Where the horizontal line at this height crosses the outline.
  const crossings: number[] = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi === yj) continue;
    if (y < Math.min(yi, yj) || y > Math.max(yi, yj)) continue;
    crossings.push(xi + ((y - yi) / (yj - yi)) * (xj - xi));
  }

  if (crossings.length < 2) return 0;

  const left = Math.min(...crossings);
  const right = Math.max(...crossings);
  if (anchor.x <= left || anchor.x >= right) return 0;

  return Math.min(anchor.x - left, right - anchor.x);
}
