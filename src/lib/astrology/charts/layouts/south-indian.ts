/**
 * South Indian chart geometry.
 *
 * A four-by-four grid whose twelve outer cells hold the signs, with the middle
 * four left open.
 *
 * The defining rule is the opposite of the North Indian style: **the signs are
 * fixed to their cells and the houses rotate.** Aries is always the second cell
 * of the top row; changing the ascendant changes which cell is house 1 and the
 * numbering that follows, never where a sign sits.
 *
 * Signs run clockwise from Aries.
 */
export const SOUTH_INDIAN_VIEWBOX = 1000;
export const SOUTH_INDIAN_CELL = SOUTH_INDIAN_VIEWBOX / 4;

export type SignCell = { sign: number; column: number; row: number };

/**
 * Fixed cell for each sign, as column and row in the 4x4 grid.
 *
 * Written out rather than computed: the path around the ring is not a formula
 * anyone should have to re-derive when reading this, and a table can be checked
 * against a chart by eye.
 */
export const SOUTH_INDIAN_SIGN_CELLS: readonly SignCell[] = [
  { sign: 1, column: 1, row: 0 }, // Aries
  { sign: 2, column: 2, row: 0 }, // Taurus
  { sign: 3, column: 3, row: 0 }, // Gemini
  { sign: 4, column: 3, row: 1 }, // Cancer
  { sign: 5, column: 3, row: 2 }, // Leo
  { sign: 6, column: 3, row: 3 }, // Virgo
  { sign: 7, column: 2, row: 3 }, // Libra
  { sign: 8, column: 1, row: 3 }, // Scorpio
  { sign: 9, column: 0, row: 3 }, // Sagittarius
  { sign: 10, column: 0, row: 2 }, // Capricorn
  { sign: 11, column: 0, row: 1 }, // Aquarius
  { sign: 12, column: 0, row: 0 }, // Pisces
] as const;

export function cellRect(cell: SignCell): { x: number; y: number; width: number; height: number } {
  return {
    x: cell.column * SOUTH_INDIAN_CELL,
    y: cell.row * SOUTH_INDIAN_CELL,
    width: SOUTH_INDIAN_CELL,
    height: SOUTH_INDIAN_CELL,
  };
}

export function cellCentre(cell: SignCell): { x: number; y: number } {
  const rect = cellRect(cell);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}
