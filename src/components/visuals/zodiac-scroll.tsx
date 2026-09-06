"use client";

import { useEffect, useRef, useState } from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import type { ZodiacSign } from "@/config/astrology";
import { formationHalfHeightFraction } from "@/lib/star-image/formation";
import { ZODIAC_SIGNS, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";

/**
 * Walks the shared star field through the signs as the page is scrolled.
 *
 * Scroll position drives which sign is holding, so the sky answers the reader
 * rather than changing under them while they read.
 *
 * A shape only ever gathers while one of the open bands is crossing the middle
 * of the viewport, and disperses again on the way out. The star field is a
 * fixed backdrop and the rest of this page is full-width cards, so a sign
 * forming anywhere else spends its whole life behind something opaque. Rather
 * than thinning every section to make room, the bands are the room: nothing can
 * overlap a formation because nothing else is there.
 *
 * Side alternates per band, so the first one a reader reaches holds its shape
 * on the left and the next answers from the right.
 */
const HERO_FRACTION = 0.12;
/** A little clearance beyond the shape itself, so it never grazes an edge. */
const ACTIVE_MARGIN = 0.02;

type Shape = { sign: ZodiacSign; align: "left" | "right" } | null;

export function ZodiacScroll() {
  const { setShape } = useStarFieldSource();
  const [enabled, setEnabled] = useState(false);
  const last = useRef<Shape>(null);

  // Reduced-motion visitors never load the canvas, so this would only be
  // watching scroll for a background that does not exist.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnabled(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;

    const apply = (next: Shape) => {
      const previous = last.current;
      if (previous?.sign === next?.sign && previous?.align === next?.align) return;
      last.current = next;

      if (!next) {
        setShape({ source: null });
        return;
      }

      setShape({ source: zodiacShapeFor(next.sign), label: next.sign, align: next.align });
    };

    const update = () => {
      frame = 0;

      const middle = window.innerHeight / 2;
      // Sized from the shape itself. A fixed fraction was far too strict on a
      // phone, where the shape is scaled against the narrow width and takes up
      // less than half the screen height it does on a desktop, so no band ever
      // qualified and nothing formed at all.
      const margin = window.innerHeight * (formationHalfHeightFraction() + ACTIVE_MARGIN);
      const bands = [...document.querySelectorAll<HTMLElement>("[data-zodiac-band]")];

      // The band must *contain* the zone the shape occupies, not merely
      // overlap it. Overlapping was enough to count as active, which meant a
      // shape could gather while the neighbouring section's card was still
      // crossing the centre of the screen - exactly the overlap the bands
      // exist to prevent.
      const activeIndex = bands.findIndex((band) => {
        const rect = band.getBoundingClientRect();
        return rect.top <= middle - margin && rect.bottom >= middle + margin;
      });

      if (activeIndex === -1) {
        apply(null);
        return;
      }

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      const through = Math.max(0, (progress - HERO_FRACTION) / (1 - HERO_FRACTION));
      const index = Math.min(ZODIAC_SIGNS.length - 1, Math.floor(through * ZODIAC_SIGNS.length));

      apply({ sign: ZODIAC_SIGNS[index], align: activeIndex % 2 === 0 ? "left" : "right" });
    };

    const onScroll = () => {
      // Coalesce a burst of scroll events into one update per frame.
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled, setShape]);

  useEffect(() => {
    return () => setShape({ source: null });
  }, [setShape]);

  return null;
}
