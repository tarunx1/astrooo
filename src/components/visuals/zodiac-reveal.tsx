"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";
import { ALIGN_MIN_WIDTH } from "@/lib/star-image/formation";
import { ZODIAC_SIGNS, zodiacShapeFor } from "@/lib/star-image/zodiac-shapes";
import { cn } from "@/lib/utils";

/**
 * Sections step aside to let a sign form in the space they leave.
 *
 * The star field is a fixed backdrop and this page is full-width cards, so a
 * formation anywhere near the content spends its life behind something opaque.
 * The previous answer was to insert empty bands with nothing in them but the
 * sign's name - screens of blank sky whose only job was to be out of the way.
 *
 * This is the opposite answer. Nothing is added; the section that is already
 * on screen shrinks toward one edge, and the sign forms in the half it frees.
 * Scroll past and the section returns to full size. The side alternates down
 * the page, so one section clears to the left and the next to the right.
 */

type RevealState = { activeIndex: number | null; side: "left" | "right" };

const ZodiacRevealContext = createContext<RevealState>({ activeIndex: null, side: "left" });

/** Which way the section at this index steps: even to the left, odd to the right. */
const sideFor = (index: number): "left" | "right" => (index % 2 === 0 ? "left" : "right");

/**
 * Where in the zodiac the page has reached. Kept as a fraction of total scroll
 * rather than one sign per section, so the reader moves through the whole
 * circle on the way down instead of seeing only the first few.
 */
const HERO_FRACTION = 0.12;

export function ZodiacRevealProvider({ children }: { children: ReactNode }) {
  const { setShape } = useStarFieldSource();
  const [state, setState] = useState<RevealState>({ activeIndex: null, side: "left" });

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;
    let lastKey = "";

    const update = () => {
      frame = 0;

      // Reduced motion never loads the canvas, and a narrow screen has no room
      // to put a shape beside anything. In both cases nothing steps aside.
      if (motion.matches || window.innerWidth < ALIGN_MIN_WIDTH) {
        if (lastKey !== "off") {
          lastKey = "off";
          setState({ activeIndex: null, side: "left" });
          setShape({ source: null });
        }
        return;
      }

      const middle = window.innerHeight / 2;
      const sections = [...document.querySelectorAll<HTMLElement>("[data-zodiac-reveal]")];

      // Exactly one section can hold the middle of the viewport, so whichever
      // does is the active one. No tie to break and no overlap to resolve.
      const active = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= middle && rect.bottom >= middle;
      });

      if (!active) {
        if (lastKey !== "none") {
          lastKey = "none";
          setState({ activeIndex: null, side: "left" });
          setShape({ source: null });
        }
        return;
      }

      const index = Number(active.dataset.zodiacReveal);
      const side = sideFor(index);

      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      const through = Math.max(0, (progress - HERO_FRACTION) / (1 - HERO_FRACTION));
      const sign = ZODIAC_SIGNS[Math.min(ZODIAC_SIGNS.length - 1, Math.floor(through * ZODIAC_SIGNS.length))];

      const key = `${index}:${sign}`;
      if (key === lastKey) return;
      lastKey = key;

      setState({ activeIndex: index, side });
      // The sign takes the half the section is not in.
      setShape({ source: zodiacShapeFor(sign), label: sign, align: side === "left" ? "right" : "left" });
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

  const value = useMemo(() => state, [state]);

  return <ZodiacRevealContext.Provider value={value}>{children}</ZodiacRevealContext.Provider>;
}

/**
 * Wraps a section so it can step aside.
 *
 * The shift is a transform rather than a width change: a width change reflows
 * the grid inside on every frame of the animation, which turns a four-column
 * row into two and back while it travels. A transform moves what is already
 * laid out, so the section arrives narrower without ever re-wrapping.
 *
 * Scaling from the outer edge rather than the centre is what actually frees a
 * side. Scaling from the centre would pull both edges inward and leave the
 * space split in two halves, neither wide enough to hold a sign.
 */
export function ZodiacReveal({ index, children }: { index: number; children: ReactNode }) {
  const { activeIndex, side } = useContext(ZodiacRevealContext);
  const active = activeIndex === index;

  return (
    <div data-zodiac-reveal={index}>
      <div
        className={cn(
          "transition-transform duration-500 ease-out motion-reduce:transition-none",
          active && side === "left" && "md:origin-left md:scale-[0.62]",
          active && side === "right" && "md:origin-right md:scale-[0.62]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
