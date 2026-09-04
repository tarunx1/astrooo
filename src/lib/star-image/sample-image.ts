import type {
  ImageMaskMode,
  ParticleImageData,
  PixelCandidate,
  SampleImageOptions,
} from "@/lib/star-image/types";

/**
 * Turns an image into particle targets.
 *
 * The pixel work is split from the DOM work on purpose. Everything that decides
 * *which* pixels matter and *where* each particle goes is a pure function over a
 * pixel buffer, so it can be tested without a browser. Only the final wrapper
 * touches Image and canvas.
 */

/** Rec. 709 luma, 0-1. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Whether the image carries a real alpha channel.
 *
 * Sampled sparsely because this only needs to distinguish "cut-out artwork"
 * from "photograph", not measure anything. A photograph is fully opaque, so any
 * meaningful amount of transparency means the artwork has a silhouette worth
 * following.
 */
export function detectTransparency(data: Uint8ClampedArray): boolean {
  let transparent = 0;
  let checked = 0;

  for (let i = 3; i < data.length; i += 16) {
    checked += 1;
    if (data[i] < 245) transparent += 1;
  }

  return checked > 0 && transparent / checked > 0.02;
}

/** Sobel-lite gradient magnitude at one pixel, used by the edges mode. */
export function edgeMagnitude(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const lumAt = (px: number, py: number) => {
    const cx = Math.max(0, Math.min(width - 1, px));
    const cy = Math.max(0, Math.min(height - 1, py));
    const i = (cy * width + cx) * 4;
    return luminance(data[i], data[i + 1], data[i + 2]);
  };

  const gx = lumAt(x + 1, y) - lumAt(x - 1, y);
  const gy = lumAt(x, y + 1) - lumAt(x, y - 1);

  return Math.sqrt(gx * gx + gy * gy);
}

/** Resolves "auto" against the actual pixels. */
export function resolveMaskMode(mode: ImageMaskMode, data: Uint8ClampedArray): Exclude<ImageMaskMode, "auto"> {
  if (mode !== "auto") return mode;
  return detectTransparency(data) ? "alpha" : "all";
}

/** Every pixel that passes the mask, in scan order. */
export function selectCandidates(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: Exclude<ImageMaskMode, "auto">,
  threshold: number,
  invertMask: boolean,
): PixelCandidate[] {
  const candidates: PixelCandidate[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Fully transparent pixels are never part of any shape.
      if (a <= 8) continue;

      let include: boolean;
      switch (mode) {
        case "all":
          include = true;
          break;
        case "alpha":
          include = a / 255 >= threshold;
          break;
        case "luminance": {
          const value = luminance(r, g, b);
          include = invertMask ? value <= threshold : value >= threshold;
          break;
        }
        case "edges":
          include = edgeMagnitude(data, width, height, x, y) >= threshold;
          break;
      }

      if (include) candidates.push({ x, y, r, g, b });
    }
  }

  return candidates;
}

/**
 * Spreads `count` particles across the candidate pixels.
 *
 * Walking the candidate list at a fixed stride rather than picking at random
 * matters: random selection clumps, and a clumped silhouette reads as noise
 * rather than as the shape. When there are fewer candidates than particles the
 * list is reused and a little jitter is added, so the extra particles thicken
 * the shape instead of stacking invisibly on top of each other.
 */
export function buildParticleData(
  candidates: PixelCandidate[],
  width: number,
  height: number,
  options: { count: number; useImageColors: boolean; random?: () => number },
): ParticleImageData {
  const { count, useImageColors } = options;
  const random = options.random ?? Math.random;

  if (candidates.length === 0) {
    throw new Error("No pixels matched the selected image mask.");
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  // Fit the longest edge to the -1..1 box so the aspect ratio survives.
  const aspect = width / height;
  const scaleX = aspect > 1 ? 1 : aspect;
  const scaleY = aspect > 1 ? 1 / aspect : 1;

  const stride = candidates.length / count;
  const jitter = candidates.length < count ? 0.01 : 0;

  for (let i = 0; i < count; i += 1) {
    const candidate =
      candidates.length >= count
        ? candidates[Math.min(candidates.length - 1, Math.floor(i * stride))]
        : candidates[i % candidates.length];

    const nx = (candidate.x / Math.max(1, width - 1) - 0.5) * 2;
    // Image y grows downwards; world y grows upwards.
    const ny = (0.5 - candidate.y / Math.max(1, height - 1)) * 2;

    positions[i * 3] = nx * scaleX + (random() - 0.5) * jitter;
    positions[i * 3 + 1] = ny * scaleY + (random() - 0.5) * jitter;
    positions[i * 3 + 2] = 0;

    if (useImageColors) {
      colors[i * 3] = candidate.r / 255;
      colors[i * 3 + 1] = candidate.g / 255;
      colors[i * 3 + 2] = candidate.b / 255;
    } else {
      // Warm starlight, slightly varied so the shape does not look printed.
      const warmth = 0.9 + random() * 0.1;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 0.96 * warmth;
      colors[i * 3 + 2] = 0.92 * warmth;
    }
  }

  return { positions, colors };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Required before a remote image's pixels can be read back.
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load particle image."));
    image.src = src;
  });
}

/**
 * Reads an image and returns particle targets.
 *
 * Browser-only. Throws rather than returning a partial result, because the
 * caller's fallback (drift back to open space) is better than a broken shape.
 */
export async function sampleImageToParticles(
  src: string,
  options: SampleImageOptions,
): Promise<ParticleImageData> {
  const {
    count,
    threshold = 0.2,
    invertMask = false,
    useImageColors = false,
    maxResolution = 360,
  } = options;

  const image = await loadImage(src);

  // Sampling at display resolution costs a lot and buys nothing: the particle
  // count, not the pixel count, is what limits detail.
  const natural = Math.max(image.naturalWidth, image.naturalHeight) || maxResolution;
  const scale = Math.min(1, maxResolution / natural);
  const width = Math.max(1, Math.round((image.naturalWidth || maxResolution) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || maxResolution) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create image sampling canvas.");

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  // Throws for a cross-origin image without permissive CORS headers. That is
  // reported to the caller rather than worked around.
  const imageData = context.getImageData(0, 0, width, height);

  const mode = resolveMaskMode(options.mode ?? "auto", imageData.data);
  const candidates = selectCandidates(imageData.data, width, height, mode, threshold, invertMask);

  return buildParticleData(candidates, width, height, { count, useImageColors });
}
