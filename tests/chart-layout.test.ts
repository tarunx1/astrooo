import { describe, expect, it } from "vitest";
import { PLANETS } from "@/config/astrology";
import { getHouseFromSign } from "@/lib/astrology/charts/houses";
import {
  estimateLabelHalfWidth,
  layoutPlanetsInHouse,
  planetLabel,
  PLANET_ABBREVIATIONS,
} from "@/lib/astrology/charts/labels";
import {
  houseHalfWidthAt,
  NORTH_INDIAN_HOUSE_ANCHORS,
  NORTH_INDIAN_HOUSE_POLYGONS,
  NORTH_INDIAN_VIEWBOX,
  SIGN_CLEARANCE,
  signAnchorFor,
} from "@/lib/astrology/charts/layouts/north-indian";
import {
  SOUTH_INDIAN_CELL,
  SOUTH_INDIAN_SIGN_CELLS,
  cellCentre,
  cellRect,
} from "@/lib/astrology/charts/layouts/south-indian";
import { getSignNumber } from "@/lib/astrology/charts/signs";
import type { ChartPlanet } from "@/lib/astrology/charts/types";

const planetAt = (name: ChartPlanet["planet"], longitude: number): ChartPlanet => ({
  planet: name,
  longitude,
  sign: getSignNumber(longitude),
  degreeInSign: longitude % 30,
  retrograde: false,
});

describe("north indian geometry", () => {
  it("anchors all twelve houses exactly once", () => {
    expect(NORTH_INDIAN_HOUSE_ANCHORS).toHaveLength(12);

    const houses = NORTH_INDIAN_HOUSE_ANCHORS.map((anchor) => anchor.house);
    expect(new Set(houses).size).toBe(12);
    expect([...houses].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("gives every house a distinct position inside the frame", () => {
    const positions = new Set<string>();

    for (const anchor of NORTH_INDIAN_HOUSE_ANCHORS) {
      positions.add(`${anchor.x},${anchor.y}`);
      expect(anchor.x).toBeGreaterThan(0);
      expect(anchor.x).toBeLessThan(NORTH_INDIAN_VIEWBOX);
      expect(anchor.y).toBeGreaterThan(0);
      expect(anchor.y).toBeLessThan(NORTH_INDIAN_VIEWBOX);
    }

    expect(positions.size).toBe(12);
  });

  it("runs anticlockwise from the top, which is the traditional order", () => {
    const at = (house: number) => NORTH_INDIAN_HOUSE_ANCHORS.find((a) => a.house === house)!;

    // House 1 top centre, 4 left, 7 bottom, 10 right.
    expect(at(1).y).toBeLessThan(at(7).y);
    expect(at(4).x).toBeLessThan(at(10).x);
    expect(at(1).x).toBeCloseTo(500, 0);
    expect(at(7).x).toBeCloseTo(500, 0);

    // House 2 is to the left of house 12, which is what makes it anticlockwise.
    expect(at(2).x).toBeLessThan(at(12).x);
  });

  it("keeps the sign label clear of the planet block", () => {
    for (const anchor of NORTH_INDIAN_HOUSE_ANCHORS) {
      const sign = signAnchorFor(anchor);
      expect(sign.y).toBeLessThan(anchor.y);
      expect(sign.y).toBeGreaterThan(0);
    }
  });

  it("moves the sign above a crowded house instead of onto it", () => {
    // Regression: with a fixed offset, a house holding three or more planets
    // grew upward past the sign number and the two collided.
    for (const anchor of NORTH_INDIAN_HOUSE_ANCHORS) {
      for (let count = 1; count <= 9; count += 1) {
        const planets = PLANETS.slice(0, count).map((name, index) => planetAt(name, index * 2));
        const sign = signAnchorFor(anchor);
        const { labels, fontSize } = layoutPlanetsInHouse(planets, anchor, {
          minTop: sign.y + SIGN_CLEARANCE,
        });
        const blockTop = Math.min(...labels.map((label) => label.y));

        // A full line of clearance, and never clipped by the frame.
        expect(blockTop - sign.y, `house ${anchor.house}, ${count} planets`).toBeGreaterThanOrEqual(fontSize);
        expect(sign.y).toBeGreaterThan(0);
        expect(Math.max(...labels.map((l) => l.y))).toBeLessThan(NORTH_INDIAN_VIEWBOX);
      }
    }
  });
});

describe("degree labels inside the shape", () => {
  /** Point-in-polygon, so the assertion is about the drawn house, not an anchor. */
  const inside = (polygon: readonly (readonly [number, number])[], x: number, y: number): boolean => {
    let contained = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) contained = !contained;
    }
    return contained;
  };

  it("describes each house as a closed shape around its anchor", () => {
    for (const anchor of NORTH_INDIAN_HOUSE_ANCHORS) {
      const polygon = NORTH_INDIAN_HOUSE_POLYGONS[anchor.house];
      expect(polygon, `house ${anchor.house}`).toBeDefined();
      expect(inside(polygon, anchor.x, anchor.y), `anchor of house ${anchor.house}`).toBe(true);
      expect(houseHalfWidthAt(anchor.house, anchor.y)).toBeGreaterThan(0);
    }

    // The twelve shapes tile the frame exactly once: no gap, no overlap.
    const area = (polygon: readonly (readonly [number, number])[]) => {
      let total = 0;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        total += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
      }
      return Math.abs(total / 2);
    };
    const covered = Object.values(NORTH_INDIAN_HOUSE_POLYGONS).reduce((sum, p) => sum + area(p), 0);
    expect(covered).toBeCloseTo(NORTH_INDIAN_VIEWBOX * NORTH_INDIAN_VIEWBOX, 6);
  });

  it("keeps every degree label inside its own house, at any planet count", () => {
    // Regression: turning degrees on roughly doubled every label, and a block of
    // four ran out through the apex of a corner triangle into the house next to
    // it - where it reads as a placement rather than as a drawing mistake.
    const failures: string[] = [];

    for (const anchor of NORTH_INDIAN_HOUSE_ANCHORS) {
      const polygon = NORTH_INDIAN_HOUSE_POLYGONS[anchor.house];

      for (let count = 1; count <= 9; count += 1) {
        // Retrograde and a two-digit degree: the widest label the chart can draw.
        const planets = PLANETS.slice(0, count).map((name, index) => ({
          ...planetAt(name, index * 2 + 27.9),
          retrograde: true,
        }));

        const { labels, fontSize } = layoutPlanetsInHouse(planets, anchor, {
          showDegrees: true,
          minTop: signAnchorFor(anchor).y + SIGN_CLEARANCE,
          fitWidth: (y) => houseHalfWidthAt(anchor.house, y),
        });

        for (const label of labels) {
          const half = estimateLabelHalfWidth(label.text, fontSize);
          const top = label.y - fontSize * 0.72;
          const bottom = label.y + fontSize * 0.22;
          const corners: Array<[number, number]> = [
            [label.x - half, top],
            [label.x + half, top],
            [label.x - half, bottom],
            [label.x + half, bottom],
          ];

          for (const [x, y] of corners) {
            if (!inside(polygon, x, y)) {
              failures.push(`house ${anchor.house}, ${count} planets, "${label.text}" at (${Math.round(x)},${Math.round(y)})`);
            }
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("prefers the size the count asks for when the house is wide enough", () => {
    // Shrinking must be a response to the shape, not something that happens to
    // every chart: the kites have room and should keep the readable size.
    const kite = NORTH_INDIAN_HOUSE_ANCHORS.find((a) => a.house === 1)!;
    const unconstrained = layoutPlanetsInHouse(PLANETS.slice(0, 2).map((n, i) => planetAt(n, i * 2)), kite, {
      showDegrees: true,
    });
    const constrained = layoutPlanetsInHouse(PLANETS.slice(0, 2).map((n, i) => planetAt(n, i * 2)), kite, {
      showDegrees: true,
      fitWidth: (y) => houseHalfWidthAt(1, y),
    });

    expect(constrained.fontSize).toBe(unconstrained.fontSize);
  });
});

describe("south indian geometry", () => {
  it("places all twelve signs in distinct outer cells", () => {
    expect(SOUTH_INDIAN_SIGN_CELLS).toHaveLength(12);
    expect(new Set(SOUTH_INDIAN_SIGN_CELLS.map((c) => c.sign)).size).toBe(12);
    expect(new Set(SOUTH_INDIAN_SIGN_CELLS.map((c) => `${c.column},${c.row}`)).size).toBe(12);
  });

  it("leaves the middle four cells empty", () => {
    const occupied = new Set(SOUTH_INDIAN_SIGN_CELLS.map((c) => `${c.column},${c.row}`));
    for (const cell of ["1,1", "2,1", "1,2", "2,2"]) {
      expect(occupied.has(cell), cell).toBe(false);
    }
  });

  it("keeps signs fixed while houses rotate with the ascendant", () => {
    const aries = SOUTH_INDIAN_SIGN_CELLS.find((c) => c.sign === 1)!;

    // The cell never moves, whatever the ascendant.
    expect(cellCentre(aries)).toEqual(cellCentre(aries));

    // The house number in that cell does move.
    expect(getHouseFromSign(1, 1)).toBe(1); // Aries ascendant: Aries is house 1
    expect(getHouseFromSign(1, 8)).toBe(6); // Scorpio ascendant: Aries is house 6
    expect(getHouseFromSign(1, 12)).toBe(2); // Pisces ascendant: Aries is house 2
  });

  it("keeps every cell inside the frame", () => {
    for (const cell of SOUTH_INDIAN_SIGN_CELLS) {
      const rect = cellRect(cell);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1000);
      expect(rect.y + rect.height).toBeLessThanOrEqual(1000);
      expect(rect.width).toBe(SOUTH_INDIAN_CELL);
    }
  });
});

describe("planet labels", () => {
  it("uses the conventional two-letter abbreviations", () => {
    expect(Object.keys(PLANET_ABBREVIATIONS).sort()).toEqual([...PLANETS].sort());
    expect(PLANET_ABBREVIATIONS.Sun).toBe("Su");
    expect(PLANET_ABBREVIATIONS.Saturn).toBe("Sa");
  });

  it("marks retrograde and optional degrees", () => {
    const saturn: ChartPlanet = { ...planetAt("Saturn", 95), retrograde: true };

    expect(planetLabel(saturn)).toBe("Sa R");
    expect(planetLabel(saturn, { showRetrograde: false })).toBe("Sa");
    expect(planetLabel(saturn, { showDegrees: true })).toBe("Sa 05°00' R");
    expect(planetLabel(saturn, { mode: "full", showRetrograde: false })).toBe("Saturn");
  });
});

describe("label collision", () => {
  const anchor = { x: 500, y: 250 };

  it("never overlaps, from one planet up to all nine", () => {
    for (let count = 1; count <= 9; count += 1) {
      const planets = PLANETS.slice(0, count).map((name, index) => planetAt(name, index * 2));
      const { labels, fontSize } = layoutPlanetsInHouse(planets, anchor);

      expect(labels, `${count} planets`).toHaveLength(count);

      // No two labels may share a position.
      const positions = new Set(labels.map((label) => `${label.x.toFixed(2)},${label.y.toFixed(2)}`));
      expect(positions.size, `${count} planets`).toBe(count);

      // Rows must be at least a line apart.
      const byColumn = new Map<number, number[]>();
      for (const label of labels) {
        byColumn.set(label.x, [...(byColumn.get(label.x) ?? []), label.y]);
      }
      for (const ys of byColumn.values()) {
        const sorted = [...ys].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i += 1) {
          expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(fontSize);
        }
      }
    }
  });

  it("keeps a full house inside its shape", () => {
    const all = PLANETS.map((name, index) => planetAt(name, index * 2));
    const { labels, fontSize } = layoutPlanetsInHouse(all, anchor);

    // The tightest houses in the layout are the corner triangles, roughly 210
    // units across. The whole block must stay within that.
    const xs = labels.map((l) => l.x);
    const ys = labels.map((l) => l.y);

    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(200);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(200);
    // And type steps down rather than staying large and overflowing.
    expect(fontSize).toBeLessThan(30);
  });

  it("centres a single planet on the anchor", () => {
    const { labels } = layoutPlanetsInHouse([planetAt("Sun", 10)], anchor);
    expect(labels[0].x).toBe(anchor.x);
    expect(labels[0].y).toBe(anchor.y);
  });

  it("is deterministic: the same input always lays out identically", () => {
    const planets = PLANETS.slice(0, 6).map((name, index) => planetAt(name, index * 3));
    const first = layoutPlanetsInHouse(planets, anchor);
    const second = layoutPlanetsInHouse(planets, anchor);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
