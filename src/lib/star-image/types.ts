/** Which pixels of an image become particles. */
export type ImageMaskMode = "auto" | "alpha" | "all" | "luminance" | "edges";

export type SampleImageOptions = {
  /** How many particles the caller needs. Always produces exactly this many. */
  count: number;
  mode?: ImageMaskMode;
  /** 0-1. Meaning depends on the mode. */
  threshold?: number;
  /** Select dark pixels instead of light ones. For dark art on a light page. */
  invertMask?: boolean;
  /** Take each particle's colour from the image rather than using starlight. */
  useImageColors?: boolean;
  /** Longest edge the image is downscaled to before reading pixels. */
  maxResolution?: number;
};

/** Particle targets in a -1..1 box, ready to be scaled into world units. */
export type ParticleImageData = {
  positions: Float32Array;
  colors: Float32Array;
};

export type PixelCandidate = {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
};
