"use client";

import { useEffect, useState } from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { ZODIAC_SIGNS, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";

/**
 * Slowly walks the shared star field through the twelve signs.
 *
 * Each sign gathers, holds, then disperses back to open sky before the next one
 * begins. The pause is not decoration: a shape that is always present sits
 * behind the hero copy the whole time, and open sky between signs keeps the
 * page readable and makes each formation feel deliberate rather than restless.
 *
 * Renders nothing and starts from a different sign on each visit, so the page
 * does not always open on Aries.
 */
const HOLD_MS = 7000;
const DISPERSE_MS = 3500;

export function ZodiacCycle() {
  const { setSource } = useStarFieldSource();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * ZODIAC_SIGNS.length));
  const [formed, setFormed] = useState(false);

  // Reduced-motion visitors never load the canvas at all, so this would only be
  // scheduling timers for a background that does not exist.
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnabled(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // A short delay before the first shape so the page settles first.
    const timer = window.setTimeout(
      () => {
        if (formed) {
          setFormed(false);
          setIndex((current) => (current + 1) % ZODIAC_SIGNS.length);
        } else {
          setFormed(true);
        }
      },
      formed ? HOLD_MS : DISPERSE_MS,
    );

    return () => window.clearTimeout(timer);
  }, [enabled, formed]);

  useEffect(() => {
    if (!enabled) return;
    setSource(formed ? zodiacShapeFor(ZODIAC_SIGNS[index]) : null);
  }, [enabled, formed, index, setSource]);

  useEffect(() => {
    return () => setSource(null);
  }, [setSource]);

  return null;
}
