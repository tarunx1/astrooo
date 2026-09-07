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
