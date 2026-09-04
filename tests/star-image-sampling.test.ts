import { describe, expect, it } from "vitest";
import {
  buildParticleData,
  detectTransparency,
  edgeMagnitude,
  luminance,
  resolveMaskMode,
  selectCandidates,
} from "@/lib/star-image/sample-image";
import { toZodiacSign, zodiacShapeFor, ZODIAC_SIGNS } from "@/lib/star-image/zodiac-shapes";

/**
 * Image sampling.
 *
 * The pixel logic is pure, so it is tested directly on synthetic buffers rather
 * than through a browser canvas. Randomness is injected where a value is
 * asserted, so nothing here depends on luck.
 */

/** Builds an RGBA buffer from a small ASCII picture. */
function pixels(rows: string[], palette: Record<string, [number, number, number, number]>) {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * height * 4);

  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const [r, g, b, a] = palette[char];
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    });
  });

  return { data, width, height };
}

const OPAQUE_WHITE: [number, number, number, number] = [255, 255, 255, 255];
const TRANSPARENT: [number, number, number, number] = [0, 0, 0, 0];
const OPAQUE_BLACK: [number, number, number, number] = [0, 0, 0, 255];

const seeded = () => {
  let n = 0;
  return () => {
    n += 1;
    return (n % 10) / 10;
  };
};

describe("luminance", () => {
  it("ranks white above mid-grey above black", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1);
    expect(luminance(0, 0, 0)).toBeCloseTo(0);
    expect(luminance(128, 128, 128)).toBeGreaterThan(0.4);
    expect(luminance(128, 128, 128)).toBeLessThan(0.6);
  });

  it("weights green most, as human vision does", () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
    expect(luminance(255, 0, 0)).toBeGreaterThan(luminance(0, 0, 255));
  });
});

describe("mask mode detection", () => {
  it("chooses alpha for cut-out artwork", () => {
    const { data } = pixels(
      ["....", ".##.", ".##.", "...."],
      { ".": TRANSPARENT, "#": OPAQUE_WHITE },
    );
    expect(resolveMaskMode("auto", data)).toBe("alpha");
    expect(detectTransparency(data)).toBe(true);
  });

  it("chooses all for a fully opaque photograph", () => {
    const { data } = pixels(["####", "####"], { "#": OPAQUE_WHITE });
    expect(resolveMaskMode("auto", data)).toBe("all");
    expect(detectTransparency(data)).toBe(false);
  });

  it("never overrides an explicit mode", () => {
    const { data } = pixels(["##"], { "#": OPAQUE_WHITE });
    expect(resolveMaskMode("edges", data)).toBe("edges");
    expect(resolveMaskMode("luminance", data)).toBe("luminance");
  });
});

describe("candidate selection", () => {
  const shape = pixels(
    [".....", ".###.", ".###.", ".....", "....."],
    { ".": TRANSPARENT, "#": OPAQUE_WHITE },
  );

  it("alpha mode keeps only the opaque silhouette", () => {
    const found = selectCandidates(shape.data, shape.width, shape.height, "alpha", 0.1, false);
    expect(found).toHaveLength(6);
    expect(found.every((c) => c.x >= 1 && c.x <= 3 && c.y >= 1 && c.y <= 2)).toBe(true);
  });

  it("all mode still skips fully transparent pixels", () => {
    // A transparent pixel carries no shape, whatever the mode.
    const found = selectCandidates(shape.data, shape.width, shape.height, "all", 0, false);
    expect(found).toHaveLength(6);
  });

  it("luminance mode respects the threshold", () => {
    const mixed = pixels(["#o#"], { "#": OPAQUE_WHITE, o: [80, 80, 80, 255] });
    const bright = selectCandidates(mixed.data, mixed.width, mixed.height, "luminance", 0.5, false);
    expect(bright).toHaveLength(2);
  });

  it("luminance invert selects the dark pixels instead", () => {
    const mixed = pixels(["#o#"], { "#": OPAQUE_WHITE, o: [80, 80, 80, 255] });
    const dark = selectCandidates(mixed.data, mixed.width, mixed.height, "luminance", 0.5, true);
    expect(dark).toHaveLength(1);
    expect(dark[0].x).toBe(1);
  });

  it("edges mode follows the contour rather than filling the shape", () => {
    const block = pixels(
      ["#####", "#...#", "#...#", "#####"],
      { "#": OPAQUE_WHITE, ".": OPAQUE_BLACK },
    );
    const edges = selectCandidates(block.data, block.width, block.height, "edges", 0.3, false);
    const filled = selectCandidates(block.data, block.width, block.height, "all", 0, false);

    expect(edges.length).toBeGreaterThan(0);
    // A contour must be a strict subset of the whole image.
    expect(edges.length).toBeLessThan(filled.length);
  });

  it("reports a positive gradient across a boundary and none inside a flat area", () => {
    const block = pixels(["##..", "##.."], { "#": OPAQUE_WHITE, ".": OPAQUE_BLACK });
    expect(edgeMagnitude(block.data, block.width, block.height, 1, 0)).toBeGreaterThan(0.3);

    const flat = pixels(["####", "####"], { "#": OPAQUE_WHITE });
    expect(edgeMagnitude(flat.data, flat.width, flat.height, 1, 1)).toBeCloseTo(0);
  });
});

describe("particle data", () => {
  const candidates = selectCandidates(
    ...(() => {
      const p = pixels([".##.", ".##."], { ".": TRANSPARENT, "#": OPAQUE_WHITE });
      return [p.data, p.width, p.height, "alpha", 0.1, false] as const;
    })(),
  );

  it("always produces exactly the requested particle count", () => {
    for (const count of [1, 7, 500]) {
      const data = buildParticleData(candidates, 4, 2, { count, useImageColors: false, random: seeded() });
      expect(data.positions).toHaveLength(count * 3);
      expect(data.colors).toHaveLength(count * 3);
    }
  });

  it("keeps every particle inside the normalised box", () => {
    const data = buildParticleData(candidates, 4, 2, { count: 200, useImageColors: false, random: seeded() });
    for (const value of data.positions) expect(Math.abs(value)).toBeLessThanOrEqual(1.05);
  });

  it("preserves aspect ratio by fitting the longest edge", () => {
    // Use a shape that fills the frame, so the extents describe the image and
    // not just where the pixels happened to sit.
    const full = pixels(["####", "####"], { "#": OPAQUE_WHITE });
    const filling = selectCandidates(full.data, 4, 2, "all", 0, false);

    const extent = (data: { positions: Float32Array }, count: number) => {
      let maxX = 0;
      let maxY = 0;
      for (let i = 0; i < count; i += 1) {
        maxX = Math.max(maxX, Math.abs(data.positions[i * 3]));
        maxY = Math.max(maxY, Math.abs(data.positions[i * 3 + 1]));
      }
      return { maxX, maxY };
    };

    // 4x2 is twice as wide as tall, so height is fitted to half the width.
    const wide = extent(buildParticleData(filling, 4, 2, { count: 300, useImageColors: false, random: () => 0.5 }), 300);
    expect(wide.maxX).toBeCloseTo(1, 1);
    expect(wide.maxY).toBeCloseTo(0.5, 1);

    // A frame that is taller than it is wide inverts the relationship.
    const tallImage = pixels(["##", "##", "##", "##"], { "#": OPAQUE_WHITE });
    const tallPixels = selectCandidates(tallImage.data, 2, 4, "all", 0, false);
    const tall = extent(buildParticleData(tallPixels, 2, 4, { count: 300, useImageColors: false, random: () => 0.5 }), 300);
    expect(tall.maxY).toBeCloseTo(1, 1);
    expect(tall.maxX).toBeCloseTo(0.5, 1);
  });

  it("uses image colours only when asked", () => {
    const red = [{ x: 0, y: 0, r: 255, g: 0, b: 0 }];

    const fromImage = buildParticleData(red, 1, 1, { count: 1, useImageColors: true, random: () => 0.5 });
    expect([...fromImage.colors]).toEqual([1, 0, 0]);

    const starlight = buildParticleData(red, 1, 1, { count: 1, useImageColors: false, random: () => 0.5 });
    // Warm white, never the image's red: red full, green slightly under, blue
    // lowest. That ordering is what makes it read as starlight rather than grey.
    expect(starlight.colors[0]).toBe(1);
    expect(starlight.colors[1]).toBeLessThan(starlight.colors[0]);
    expect(starlight.colors[2]).toBeLessThan(starlight.colors[1]);
    expect(starlight.colors[2]).toBeGreaterThan(0.8);
  });

  it("raises a safe error when nothing matched the mask", () => {
    expect(() => buildParticleData([], 4, 4, { count: 10, useImageColors: false })).toThrow(
      /No pixels matched/,
    );
  });

  it("spreads particles across the shape rather than stacking them on one pixel", () => {
    const data = buildParticleData(candidates, 4, 2, { count: 40, useImageColors: false, random: seeded() });
    const distinct = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      distinct.add(`${data.positions[i * 3].toFixed(2)},${data.positions[i * 3 + 1].toFixed(2)}`);
    }
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("zodiac shapes", () => {
  it("provides a sampleable glyph for all twelve signs", () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
    for (const sign of ZODIAC_SIGNS) {
      const uri = zodiacShapeFor(sign);
      expect(uri.startsWith("data:image/svg+xml")).toBe(true);

      // A data URI cannot taint the sampling canvas the way a remote file can,
      // so the glyph must not pull in anything: no external image, font or
      // stylesheet. The xmlns is a namespace identifier, not a fetch.
      const svg = decodeURIComponent(uri);
      expect(svg).toContain("<path");
      expect(svg).not.toMatch(/<(image|script|use|style)\b/);
      expect(svg).not.toMatch(/(href|src)=/);
    }
  });

  it("returns the same instance for a repeated sign", () => {
    expect(zodiacShapeFor("Leo")).toBe(zodiacShapeFor("Leo"));
    expect(zodiacShapeFor("Leo")).not.toBe(zodiacShapeFor("Virgo"));
  });

  it("narrows stored calculation values to a known sign", () => {
    expect(toZodiacSign("Leo")).toBe("Leo");
    expect(toZodiacSign(" scorpio ")).toBe("Scorpio");
  });

  it("treats an absent or unrecognised value as open sky", () => {
    for (const value of [null, undefined, "", "Ophiuchus", "not a sign"]) {
      expect(toZodiacSign(value)).toBeNull();
    }
  });
});
