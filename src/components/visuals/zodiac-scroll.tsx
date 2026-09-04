"use client";

import { useEffect, useRef, useState } from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { ZODIAC_SIGNS, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";

/**
 * Walks the shared star field through the signs as the page is scrolled.
 *
 * Scroll position drives the shape rather than a timer, so the sky responds to
 * the reader instead of changing under them while they are trying to read. A
 * sign holds for as long as they stay there.
 *
 * The first stretch of the page is deliberately left as open sky. That is the
 * hero, where the headline and the call to action sit, and a glyph gathering
 * behind that copy competes with it. Formation begins once the reader has moved
 * past it and the page has room for the shape.
 */
const HERO_FRACTION = 0.12;

export function ZodiacScroll() {
  const { setShape } = useStarFieldSource();
  const [enabled, setEnabled] = useState(false);
  const lastIndex = useRef<number | null>(null);

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

    const update = () => {
      frame = 0;

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;

      // Open sky across the hero.
      if (progress < HERO_FRACTION) {
        if (lastIndex.current !== null) {
          lastIndex.current = null;
          setShape({ source: null });
        }
        return;
      }

      const through = (progress - HERO_FRACTION) / (1 - HERO_FRACTION);
      const index = Math.min(ZODIAC_SIGNS.length - 1, Math.floor(through * ZODIAC_SIGNS.length));

      // Only re-target when the sign actually changes; scrolling fires far more
      // often than the shape needs to move, and re-sampling on every pixel of
      // travel would be wasted work.
      if (lastIndex.current === index) return;
      lastIndex.current = index;

      const sign = ZODIAC_SIGNS[index];
      setShape({ source: zodiacShapeFor(sign), label: sign });
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
