"use client";

import { useEffect, useState } from "react";
import { SIGNS } from "@/config/astrology";
import { ZODIAC_GLYPH_PATHS } from "@/lib/star-image/zodiac-shapes";

/**
 * The signs taking their turn in the hollow centre of the hero wheel.
 *
 * Each sign is drawn from the same glyph path twice over, as a lit neon tube:
 * a wide soft stroke of gold carrying the bloom, and a thin near-white core
 * burning down the middle of it. Both come from one path, so the light always
 * traces the sign exactly.
 *
 * The wheel around it spins; this does not. It sits in the wheel's wrapper
 * rather than inside the rotating element, so the glyph stays upright.
 */

/** How long each sign holds the centre, fade in and out included. */
const HOLD_MS = 5200;

/** Filter id. Fixed rather than generated - only one hub exists per page. */
const NEON_FILTER = "zodiac-hub-neon";

export function ZodiacHubCycle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Reduced motion keeps the first sign rather than cycling. The sequence is
    // decoration, and decoration is not worth moving the page under someone who
    // has asked it to stop.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % SIGNS.length);
    }, HOLD_MS);

    return () => window.clearInterval(id);
  }, []);

  const sign = SIGNS[index];
  const path = ZODIAC_GLYPH_PATHS[sign];

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[31%] -translate-x-1/2 -translate-y-1/2">
      {/* Keyed on the sign so React replaces the node and the entrance
          animation runs again for each one. */}
      <div className="zodiac-hub-sign absolute inset-0 grid place-items-center" key={sign}>
        <svg
          aria-hidden="true"
          className="size-full overflow-visible"
          viewBox="0 0 100 100"
        >
          <defs>
            {/* The bloom is an SVG filter rather than a CSS one so its radius is
                measured in the 100-unit viewBox. A CSS blur would be in screen
                pixels and would grow or shrink with the hero's width. */}
            <filter id={NEON_FILTER} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" result="wide" stdDeviation="2.6" />
              <feMerge>
                <feMergeNode in="wide" />
                <feMergeNode in="wide" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Neon is two strokes, not one: a wide soft tube of colour with a
              thin near-white core burning down the middle of it. A single
              stroke can be bright or soft but never reads as lit glass. */}
          <path
            className="zodiac-hub-neon-tube"
            d={path}
            fill="none"
            filter={`url(#${NEON_FILTER})`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="zodiac-hub-neon-core"
            d={path}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="zodiac-hub-name absolute -bottom-1 caption tracking-[0.32em] text-premium">
          {sign.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
