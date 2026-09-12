"use client";

import { useEffect, type ReactNode } from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { ALIGN_MIN_WIDTH, formationHalfHeightFraction } from "@/lib/star-image/formation";
import { ZODIAC_SIGNS, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";
import { cn } from "@/lib/utils";

/**
 * Sections keep a permanent strip of sky beside them for a sign to form in.
 *
 * The star field is a fixed backdrop and this page is full-width cards, so a
 * formation anywhere near the content spends its life behind something opaque.
 * Two earlier answers were worse. Inserting empty bands gave up whole screens
 * of blank sky whose only job was to be out of the way. Letting the section
 * step aside as the sign arrived kept the page dense, but it meant content
 * moved sideways under the reader while they were looking at it.
 *
 * So the space is reserved up front instead of taken on arrival. Every wrapped
 * section is laid out against a gutter it always has, whether a sign is forming
 * in it or not, and nothing shifts left or right at any point in the scroll.
 * The gutter alternates down the page - one section clears to the left, the
 * next to the right - so the reserved strips read as a rhythm rather than as a
 * permanently lopsided page.
 */

/** Which side the gutter is on: even sections clear right, odd sections left. */
const gutterFor = (index: number): "left" | "right" => (index % 2 === 0 ? "right" : "left");

/**
 * Where in the zodiac the page has reached. Kept as a fraction of total scroll
 * rather than one sign per section, so the reader moves through the whole
 * circle on the way down instead of seeing only the first few.
 */
const HERO_FRACTION = 0.12;

/**
 * Drives which sign the shared star field forms as the page scrolls.
 *
 * Holds no state of its own. The layout no longer reacts to the active section,
 * so the only output is the shape handed to the star field - which means a
 * scroll does not re-render the page under the canvas.
 */
export function ZodiacRevealProvider({ children }: { children: ReactNode }) {
  const { setShape } = useStarFieldSource();

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let lastKey = "";

    const update = () => {
      frame = 0;

      // Reduced motion never loads the canvas, and below this width no section
      // reserves a gutter. In both cases there is nowhere for a sign to form.
      if (motion.matches || window.innerWidth < ALIGN_MIN_WIDTH) {
        if (lastKey !== "off") {
          lastKey = "off";
          setShape({ source: null });
        }
        return;
      }

      const middle = window.innerHeight / 2;
      const sections = [...document.querySelectorAll<HTMLElement>("[data-zodiac-reveal]")];

      // The sign forms centred in the viewport, so the section's gutter has to
      // clear that whole band - not merely touch the middle of it. Sections
      // have opaque backgrounds: one that only overlaps the centre leaves the
      // top or bottom of the glyph behind the neighbouring section, which is
      // why the sign used to appear cut in half at a section boundary.
      const margin = window.innerHeight * (formationHalfHeightFraction() + 0.02);
      const active = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= middle - margin && rect.bottom >= middle + margin;
      });

      if (!active) {
        if (lastKey !== "none") {
          lastKey = "none";
          setShape({ source: null });
        }
        return;
      }

      const index = Number(active.dataset.zodiacReveal);

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      const through = Math.max(0, (progress - HERO_FRACTION) / (1 - HERO_FRACTION));
      const sign = ZODIAC_SIGNS[Math.min(ZODIAC_SIGNS.length - 1, Math.floor(through * ZODIAC_SIGNS.length))];

      const key = `${index}:${sign}`;
      if (key === lastKey) return;
      lastKey = key;

      // The sign forms in the gutter this section already keeps empty.
      setShape({ source: zodiacShapeFor(sign), label: sign, align: gutterFor(index) });
    };

    const onScroll = () => {
      // Coalesce a burst of scroll events into one update per frame.
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    motion.addEventListener("change", onScroll);
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      setShape({ source: null });
    };
  }, [setShape]);

  return <>{children}</>;
}

/**
 * Wraps a section so it holds a gutter open for a sign.
 *
 * Padding rather than a translate or a scale: the content box is simply
 * narrower on one side, so the cards inside lay out against the width they will
 * actually keep and no element is ever drawn somewhere it does not stay. The
 * class is static, so this costs nothing at scroll time.
 *
 * The 38% mirrors `FORMATION_SHIFT`, which is how far out the glyph sits. Take
 * more and a card gets too narrow to set its own heading; take less and the
 * sign forms partly behind one. Below `lg` the gutter is dropped entirely and
 * the formation moves above the content instead.
 */
export function ZodiacReveal({ index, children }: { index: number; children: ReactNode }) {
  const gutter = gutterFor(index);

  return (
    <div data-zodiac-reveal={index}>
      <div className={cn(gutter === "right" ? "lg:pr-[38%]" : "lg:pl-[38%]")}>{children}</div>
    </div>
  );
}
