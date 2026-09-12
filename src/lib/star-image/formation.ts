/**
 * Geometry of a formed shape in the star field.
 *
 * Lives apart from the canvas so the scroll driver can size its own logic from
 * the same numbers without importing three, which would pull the whole WebGL
 * bundle into a component that is not lazy loaded.
 */
export const CAMERA_Z = 18;
export const CAMERA_FOV = 52;

/**
 * Fraction of the shorter visible dimension a formed shape occupies.
 *
 * Sized to sit beside a section rather than to fill the screen. A larger sign
 * looks better on its own but forces the section next to it into columns too
 * narrow to set their own headings.
 */
export const FORMATION_FILL = 0.5;
/**
 * How far off centre an aligned shape sits, as a fraction of visible width.
 *
 * This is the same number as the gutter a section permanently reserves in
 * `ZodiacReveal`, and the two have to stay in step: the sign sits in space the
 * layout has already set aside, so moving one without the other either buries
 * the glyph under a card or leaves a strip of empty sky nothing ever uses.
 */
export const FORMATION_SHIFT = 0.38;
/**
 * Below this the viewport is too narrow to spare a gutter, so no section
 * reserves one and an aligned formation moves up rather than sideways.
 *
 * Matches Tailwind's `lg` breakpoint, which is where the reserved gutter turns
 * on. A viewport between `md` and `lg` can technically fit a glyph beside a
 * section, but only by squeezing the cards next to it into a single column.
 */
export const ALIGN_MIN_WIDTH = 1024;

export type StarFieldAlign = "left" | "center" | "right";

/** What the camera can see at the origin plane, in world units. */
export function visibleExtent(): { width: number; height: number } {
  const height = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const aspect = typeof window === "undefined" ? 16 / 9 : window.innerWidth / window.innerHeight;

  return { width: height * aspect, height };
}

/**
 * Half the width a formed shape should occupy, in world units.
 *
 * Derived from what the camera can see rather than fixed, because the visible
 * width collapses on a narrow screen: a constant that frames a glyph nicely on
 * a desktop makes it overflow a phone.
 */
export function formationScaleForViewport(): number {
  const { width, height } = visibleExtent();
  return (Math.min(width, height) * FORMATION_FILL) / 2;
}

/** Where the shape sits relative to centre, in world units. */
export function formationOffsetForViewport(align: StarFieldAlign): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };

  const { width, height } = visibleExtent();

  // A narrow viewport has no room to sit a shape beside anything, so it moves
  // up instead and the copy goes underneath. Pushing it half off the side would
  // be worse than not moving it at all.
  if (window.innerWidth < ALIGN_MIN_WIDTH) {
    return { x: 0, y: align === "center" ? 0 : height * 0.17 };
  }

  if (align === "center") return { x: 0, y: 0 };

  const shift = width * FORMATION_SHIFT;
  return { x: align === "left" ? -shift : shift, y: 0 };
}

/**
 * Half the shape's height as a fraction of the viewport.
 *
 * The scroll driver uses this to decide whether a band has enough clear space
 * to hold a formation. A fixed value would be wrong on both ends: it is about
 * 0.31 of the screen on a desktop and less than half that on a phone, where the
 * shape is sized against the narrow width instead.
 */
export function formationHalfHeightFraction(): number {
  const { width, height } = visibleExtent();
  return (Math.min(width, height) * FORMATION_FILL) / height / 2;
}
