import { SIGNS, type ZodiacSign } from "@/config/astrology";

/**
 * Zodiac glyphs as sampleable images.
 *
 * These are drawn as SVG data URIs rather than shipped as PNG assets for three
 * reasons: nothing new enters the repository or the image host allowlist, a
 * data URI cannot taint the sampling canvas the way a cross-origin file can,
 * and a vector glyph stays crisp at whatever resolution the sampler asks for.
 *
 * Each glyph is a stroked path in a 100x100 box on a transparent ground, so the
 * sampler's `alpha` mode picks out exactly the stroke. Stroke width is what
 * gives the particles something to sit in; a hairline would starve the shape.
 */
const STROKE = 7;

/**
 * Path data per sign, drawn in a 0 0 100 100 viewBox.
 *
 * Exported because the hero draws the same glyphs directly rather than through
 * the sampler - as a dotted stroke, so the line reads as a run of stars. Two
 * sets of glyph paths would drift apart the first time one was corrected.
 */
export const ZODIAC_GLYPH_PATHS: Record<ZodiacSign, string> = {
  // Ram's horns curling out from a central stem.
  Aries:
    "M50 84 V46 M50 48 C50 30 42 18 31 18 C20 18 14 27 14 38 C14 47 18 54 25 57 M50 48 C50 30 58 18 69 18 C80 18 86 27 86 38 C86 47 82 54 75 57",
  // Bull's head: a ring beneath a pair of horns.
  Taurus:
    "M50 42 m-22 22 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M20 42 C20 22 33 12 50 25 C67 12 80 22 80 42",
  // The twins, as two figures bounded top and bottom.
  Gemini:
    "M20 22 C36 13 64 13 80 22 M20 78 C36 87 64 87 80 78 M35 18 V82 M65 18 V82",
  // The crab, as the familiar paired spirals.
  Cancer:
    "M16 40 C30 24 58 24 72 34 M84 60 C70 76 42 76 28 66 M76 32 a8 8 0 1 0 0.1 0 M24 68 a8 8 0 1 0 0.1 0",
  // Lion's mane and tail.
  Leo:
    "M34 62 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M48 56 C52 38 45 22 57 17 C69 12 78 25 71 38 C64 52 62 62 68 70 C73 77 81 78 87 73",
  // The maiden's M, closed with a loop.
  Virgo:
    "M16 30 V74 M16 34 C16 25 29 25 29 34 V74 M29 34 C29 25 42 25 42 34 V74 M42 34 C42 25 55 25 55 36 C55 54 47 62 36 68 M55 40 C61 29 74 29 78 42 C82 55 71 68 58 61",
  // The scales: a beam, a base, and the rising sun above it.
  Libra: "M14 78 H86 M20 62 H80 M30 62 C24 42 34 28 50 28 C66 28 76 42 70 62",
  // The scorpion's M, finished with a barb.
  Scorpio:
    "M14 30 V74 M14 34 C14 25 27 25 27 34 V74 M27 34 C27 25 40 25 40 34 V74 M40 34 C40 25 53 25 53 34 V66 C53 76 63 80 73 74 M66 64 L80 72 L66 82",
  // The archer's arrow, crossed.
  Sagittarius: "M20 80 L78 22 M56 22 H80 V46 M38 44 L60 66",
  // The sea-goat: horn into a curling tail.
  Capricorn:
    "M14 32 C14 23 25 23 27 32 L33 64 M33 42 C33 28 44 23 51 34 C58 45 55 62 48 72 M52 54 C65 47 80 54 80 66 C80 77 69 80 63 74 C58 69 61 60 70 61",
  // The water-bearer's two waves.
  Aquarius:
    "M14 44 L27 33 L40 44 L53 33 L66 44 L79 33 L88 41 M14 66 L27 55 L40 66 L53 55 L66 66 L79 55 L88 63",
  // Two fish bound by a cord.
  Pisces: "M28 16 C13 33 13 67 28 84 M72 16 C87 33 87 67 72 84 M16 50 H84",
};

/**
 * Wraps glyph path data in an SVG document sized for sampling.
 *
 * Rendered white because the sampler reads the alpha channel, not the colour;
 * the particles take their own starlight tint unless image colours are asked
 * for. An explicit width and height is required — an `<img>` cannot rasterise
 * an SVG that only declares a viewBox.
 */
function glyphToDataUri(path: string): string {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 100 100">`,
    `<path d="${path}" fill="none" stroke="#ffffff" stroke-width="${STROKE}"`,
    ` stroke-linecap="round" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("");

  // encodeURIComponent rather than base64: it keeps the markup readable in
  // devtools and avoids pulling in a base64 helper that differs across runtimes.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const CACHE = new Map<ZodiacSign, string>();

/** The sampleable glyph for a sign. Built once per sign, then reused. */
export function zodiacShapeFor(sign: ZodiacSign): string {
  const cached = CACHE.get(sign);
  if (cached) return cached;

  const uri = glyphToDataUri(ZODIAC_GLYPH_PATHS[sign]);
  CACHE.set(sign, uri);
  return uri;
}

/**
 * Narrows an arbitrary string to a sign.
 *
 * Values arrive from stored calculation results, so an unrecognised or absent
 * one is expected rather than exceptional: the caller simply shows open sky.
 */
export function toZodiacSign(value: string | null | undefined): ZodiacSign | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return SIGNS.find((sign) => sign.toLowerCase() === normalized) ?? null;
}

export { SIGNS as ZODIAC_SIGNS };
