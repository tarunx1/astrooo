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
import { ALIGN_MIN_WIDTH, formationHalfHeightFraction } from "@/lib/star-image/formation";
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

      // The sign forms centred in the viewport, so the section has to clear
      // that whole band - not merely touch the middle of it. Sections have
      // opaque backgrounds: a section that only overlaps the centre leaves the
      // top or bottom of the glyph behind the neighbouring one, which is why
      // the sign appeared cut in half against a section boundary.
      const margin = window.innerHeight * (formationHalfHeightFraction() + 0.02);
      const active = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= middle - margin && rect.bottom >= middle + margin;
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
 * The section gives up half its width to one side rather than sliding across
 * it. Two earlier attempts were worse: scaling it down shrank the type with
 * it, so it read as minimised rather than moved; translating it kept the type
 * full size but carried the leading edge off the screen, taking a card and a
 * half of real content with it.
 *
 * Padding does both jobs. The content box narrows toward one edge, so the
 * section moves and everything in it stays on screen at full size. The column
 * counts here are keyed to the viewport rather than the container, so the
 * cards narrow rather than re-wrapping mid-animation.
 *
 * How far it gives way is a negotiation with the sign, not a free choice. Take
 * too much and a card gets too narrow to set its own heading; take too little
 * and the sign has nowhere to be. The sign was made smaller and pushed further
 * out to meet this at 38%.
 */
export function ZodiacReveal({ index, children }: { index: number; children: ReactNode }) {
  const { activeIndex, side } = useContext(ZodiacRevealContext);
  const active = activeIndex === index;

  return (
    <div data-zodiac-reveal={index}>
      <div
        className={cn(
          "transition-[padding] duration-500 ease-out motion-reduce:transition-none",
          active && side === "left" && "md:pr-[38%]",
          active && side === "right" && "md:pl-[38%]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
