"use client";

import { useEffect, useState } from "react";
import { SIGNS } from "@/config/astrology";
import { ZODIAC_GLYPH_PATHS } from "@/lib/star-image/zodiac-shapes";

/**
 * The signs taking their turn in the hollow centre of the hero wheel.
 *
 * Each sign is drawn from the same glyph path twice over: once as a faint
 * continuous line, which reads as the lines an atlas draws between stars, and
 * once as a dotted stroke whose round caps land along that line as the stars
 * themselves. Drawing it this way rather than scattering points at random means
 * the constellation is always the sign - the stars cannot wander off it.
 *
 * The wheel around it spins; this does not. It sits in the wheel's wrapper
 * rather than inside the rotating element, so the glyph stays upright.
 */

/** How long each sign holds the centre, fade in and out included. */
const HOLD_MS = 5200;

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
          <path
            className="zodiac-hub-line"
            d={path}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="zodiac-hub-stars"
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
